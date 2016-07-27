import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { _ } from 'meteor/underscore';

let defaultConfig = {
  factors: {
    default: {
      send: (contact, token, factor = 'unknown')=>{console.log(`token: ${token} sent to ${contact} via ${factor}`);},
      // receive: () => {console.log(`receive function unsupported`);},
      settings: null,
    },
  },
  generate: ()=>Random.id(6),
  validate: ()=>true,
  settings: null,
  expiry: 5*(60*1000),  // 5 minutes in milliseconds
  retain: 5*(60*1000),
  requestInterval: 10*1000,  // 10 seconds
  requestCount: 1,
  profile: 'TokenAffirm',
};

/**
 * class representing a TokenAffirm instance
 */
export class TokenAffirm {


  /**
   * constructor - create a TokenAffirm instance
   *
   * @param  {string} identifier      a unique identifier for this instance
   * @param  {object} config = {} contains various configuration settings
   */
  constructor(identifier, config = {}){
    check(identifier, String);
    this.config = defaultConfig;
    this.validateConfig(config);
    this.collectionName = `${this.config.profile}:${identifier}:Collection${Random.id()}`;
    this.collection = new Mongo.Collection(this.collectionName);
    this.collection._ensureIndex({expireAt: 1}, {expireAfterSeconds: 0});
    this.collection._ensureIndex({verifyAt: 1}, {expireAfterSeconds: this.config.retain/1000});

    this.defineMethods(identifier);
  }


  /**
   * validateConfig - validates the configuration, replace with defaults otherwise
   *
   * @param  {object} config = {} configuration object
   */
  validateConfig(config = {}){
    _.each(config.factors, (factor, key)=>{
      this.addFactor(factor, key);
    });
    delete config.factors;
    check(config, {
      generate: Match.Maybe(Function),
      validate: Match.Maybe(Function),
      settings: Match.Maybe(Object),
      expiry: Match.Maybe(Match.Integer),
      retain: Match.Maybe(Match.Integer),
      requestInterval: Match.Maybe(Match.Integer),
      requestCount: Match.Maybe(Match.Integer),
      profile: Match.Maybe(String),
    });
    Object.assign(this.config, config);
  }

  /**
   * addFactor - add a factor to TokenAffirm instance
   *
   * @param  {string} factor sending method, user-defined function to call to send factor
   * @param  {string} key    name of factor, i.e. 'telegram', 'SMS' or 'email'
   */
  addFactor(factor, key){
    check(key, String);

    check(factor, {
      send: Function,
      // receive: Match.Maybe(Function),
      settings: Match.Maybe(Object),
    });
    // if (!factor.send) {factor.send = defaultConfig.factors.default.send;}
    // if (!factor.receive) {factor.receive = defaultConfig.factors.default.receive;}
    // if (!factor.settings) {factor.settings = defaultConfig.factors.default.settings;}
    // will overwrite existing factors
    this.config.factors[key] = factor;
  }

  /**
   * defineMethods - defines the Meteor methods required by client-side
   * also set the rate limits for the methods
   *
   * @param  {string} identifier unique identifier string, used to name methods
   */
  defineMethods(identifier){
    this.identifier = identifier;
    let prefix = `TokenAffirm:${this.identifier}`;
    let instance = this;
    Meteor.methods({

      /**
       * requestToken - allow client-side to request a confirmation token
       *
       * @throws {Meteor.Error} when contact details in user profile does not
       * correspond with configuration details of session
       * @param {string} sessionId id of previous session to invalidate
       * @returns {string}  session id of confirmation
       */
      [`${prefix}/requestToken`]:function requestToken(sessionId){
        check(sessionId, Match.Maybe(String));
        let user = Meteor.user();
        if (!user) {throw new Meteor.Error(`login required`);}
        if (sessionId) {this.invalidateSession(sessionId);}
        let notify = get(user, `profile.${instance.config.profile}`);
        check(notify, {contact: String, factor: String});
        let { contact, factor } = notify;
        if (!instance.config.factors[factor]){
          throw new Meteor.Error(`${factor} not supported`);
        }
        return instance.requestToken(contact, factor);
      },

      /**
       * verifyToken - allow client-side to verify token sent
       *
       * @param  {string} sessionId session id of TokenAffirm session
       * @param  {string} token     token sent to factor
       * @returns {boolean}           true when session is verified
       */
      [`${prefix}/verifyToken`]:function verifyToken(sessionId, token){
        check(sessionId, String);
        check(token, String);
        return instance.verifyToken(sessionId, token);
      },

      /**
       * invalidateSession - allow client-side to cancel a verification session
       *
       * @param  {string} sessionId session id of TokenAffirm session
       * @returns {number}           1 when session is removed, 0 otherwise
       */
      [`${prefix}/invalidateSession`]:function invalidateSession(sessionId){
        check(sessionId, String);
        return instance.invalidateSession(sessionId);
      },
      /**
       * verifyContact - return contact details of active user where token would be sent to
       *
       * @returns {object}  contact details
       */
      [`${prefix}/verifyContact`]:function verifyContact(){
        return instance.verifyContact();
      },
      /**
       * assertOpenSession - check if there is a session of id awaiting token
       * useful for checking if need to regenerate token
       *
       * @params {string} sessionId id of session to check
       * @returns {boolean }  true if session exist and awaiting token
       */
      [`${prefix}/assertOpenSession`]:function assertOpenSession(sessionId){
        check(sessionId, String);
        return instance.assertOpenSession();
      },
    });

    // Set DDP rate limits
    let requestTokenRule = {
      userId: this.config.validate,
      type: 'method',
      name: `${prefix}/requestToken`,
    };
    DDPRateLimiter.addRule(requestTokenRule, this.config.requestCount, this.config.requestInterval);

    let verifyTokenRule = {
      userId: this.config.validate,
      type: 'method',
      name: `${prefix}/verifyToken`,
    };
    DDPRateLimiter.addRule(verifyTokenRule, this.config.requestCount, this.config.requestInterval);

    let invalidateSessionRule = {
      userId: this.config.validate,
      type: 'method',
      name: `${prefix}/invalidateSession`,
    };
    DDPRateLimiter.addRule(invalidateSessionRule, this.config.requestCount, this.config.requestInterval);

    let verifyContactRule = {
      userId: this.config.validate,
      type: 'method',
      name: `${prefix}/verifyContact`,
    };
    DDPRateLimiter.addRule(verifyContactRule, this.config.requestCount, this.config.requestInterval);

    let assertOpenSessionRule = {
      userId: this.config.validate,
      type: 'method',
      name: `${prefix}/assertOpenSession`,
    };
    DDPRateLimiter.addRule(assertOpenSessionRule, this.config.requestCount, this.config.requestInterval);

  }

  /**
   * isVerified - check if session is verified
   *
   * @param  {string} sessionId id of session to check
   * @returns {boolean}           true when session is verified
   */
  isVerified(sessionId){
    let session = this.collection.findOne({_id: sessionId});
    return !!get(session, 'verifyAt');
  }


  /**
   * requestToken - request a token to affirm user actions
   *
   * @param  {string} contactAddress essential contact address, i.e. phone number or email address
   * @param  {string} contactMethod  name of factor, i.e. 'telegram', 'SMS' or 'email'
   * @returns {string}                id of session created
   */
  requestToken(contactAddress, contactMethod){
    let token = this.generateToken();
    let sessionId = this.createSession(token, contactMethod);
    this.sendToken(contactAddress, token, contactMethod);
    return sessionId;
  }


  /**
   * verifyToken - verify a token - session
   *
   * @param  {string} sessionId id of session to verify
   * @param  {string} token     token used to verify session
   * @returns {boolean}           true when session is verified
   */
  verifyToken(sessionId, token){
    let session = this.collection.findOne({_id: sessionId, user: Meteor.user()._id});
    if (!session){return false;}
    if (!!session.verifyAt){return false;}
    if ((new Date() - new Date(session.expireAt)) > 0) {return false;}
    if (session.token !== token) {return false;}
    this.collection.update(sessionId, {
      $set: {verifyAt: new Date()},
      $unset: {expireAt: true},
    });
    return true;
  }


  /**
   * invalidateSession - invalidates a confirmation session, does not remove
   * validated sessions
   *
   * @param  {string} sessionId id of session to invalidate
   * @returns {number}           1 if session is successfully invalidated
   */
  invalidateSession(sessionId){
    return this.collection.remove({_id: sessionId, verifyAt: {$exists: false}});
  }

  /**
   * assertOpenSession - check if there is a session of id awaiting token
   * useful for checking if need to regenerate token
   *
   * @params {string} sessionId id of session to check
   * @returns {boolean }  true if session exist and awaiting token
   */
  assertOpenSession(sessionId){
    let session = this.collection.findOne({_id: sessionId, user: Meteor.user()._id});
    if (!session) {return false;}
    if (!!session.verifyAt) {return false;}  // session is closed
    if ((new Date() - new Date(session.expireAt)) > 0) {return false;}
    return true;
  }

  /**
   * sendToken - sends token via the factor user defined
   *
   * @param  {string} contact address to send token to
   * @param  {string} token   token used for verification
   * @param  {string} factor  name of factor to sent token via
   * @returns {*}         return value of user-defined sending function
   */
  sendToken(contact, token, factor){
    let method = this.config.factors[factor];
    if (!method) {
      console.error(`error, ${factor} not supported`);
      console.log(`printing token on console, ${token}`);
    }
    return method.send(contact, token, factor);
  }


  /**
   * generateToken - generates a token, uses user defined function to create unique verification token
   *
   * @returns {string}  unique token string used for verification of session
   */
  generateToken(){
    return this.config.generate();
  }


  /**
   * createSession - creates a verification session
   *
   * @param  {string} token  unique string for verification
   * @param  {string} factor name of method token should be sent via
   * @returns {string}        id of session created
   */
  createSession(token, factor){
    return this.collection.insert({
      token,
      factor,
      expireAt: new Date((new Date()).getTime() + this.config.expiry),
      user: Meteor.user()._id,
    });
  }


  /**
   * verifyContact - return contact details of active user where token would be sent to
   *
   * @returns {object}  contact details
   */
  verifyContact(){
    return get(Meteor.user(), `profile.${this.config.profile}`);
  }
}


/**
 * get - helper function to get value in deeply nested objects
 *
 * @param  {object} obj       object to get value from
 * @param  {string|array} ...params combination of strings and arrays to navigate to value
 * @returns {*}           value to get
 */
function get (obj, ...params) {
  function getObject(object, path){
    if (_.isUndefined(object)){return undefined;}
    if (!_.isEmpty(path)){
      let cur = path.shift(1);
      return getObject(object[cur], path);
    }
    return object;
  }

  let path = _.flatten(params)
              .filter(val=>_.isString(val) || _.isNumber(val))
              .map(val=> val.toString().split(/\.|\[|\]|,/g));
  path = _.flatten(path).filter(val=>!!val);
  return getObject(obj, path);
}
