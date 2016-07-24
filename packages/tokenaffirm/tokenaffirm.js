import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { _ } from 'meteor/underscore';

let defaultConfig = {
  factors: {
    default: {
      send: (contact, token, factor = 'unknown')=>{console.log(`${factor} token: ${token} sent to ${contact}`);},
      // receive: () => {console.log(`receive function unsupported`);},
      settings: null,
    },
  },
  generate: ()=>Random.id(6),
  validate: ()=>true,
  settings: null,
  expiry: 5*(60*1000),  // in milliseconds
  retain: 5*(60*1000),
  requestInterval: 10*1000,
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
   * @param  {string} prefix      a unique identifier for this instance
   * @param  {object} config = {} contains various configuration settings
   */
  constructor(prefix, config = {}){
    check(prefix, String);
    this.config = defaultConfig;
    this.validateConfig(config);
    this.collectionName = `TokenAffirm:${prefix}:Collection${Random.id()}`;
    this.collection = new Mongo.Collection(this.collectionName);
    this.collection._ensureIndex({expireAt: 1}, {expireAfterSeconds: 0});
    this.collection._ensureIndex({verifyAt: 1}, {expireAfterSeconds: this.config.retain/1000});

    this.defineMethods(prefix);
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
   * defineMethods - defines the Meteor methods required by client-side
   * also set the rate limits for the methods
   *
   * @param  {string} prefix unique identifier string, used to name methods
   */
  defineMethods(prefix){
    this.prefix = prefix;
    let instance = this;
    Meteor.methods({

      /**
       * requestToken - allow client-side to request a confirmation token
       *
       * @throws {Meteor.Error} when contact details in user profile does not
       * correspond with configuration details of session
       * @returns {string}  session id of confirmation
       */
      [`TokenAffirm:${this.prefix}/requestToken`]:function requestToken(){
        let user = Meteor.user();
        if (!user) {throw new Meteor.Error(`login required`);}
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
      [`TokenAffirm:${this.prefix}/verifyToken`]:function verifyToken(sessionId, token){
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
      [`TokenAffirm:${this.prefix}/invalidateSession`]:function invalidateSession(sessionId){
        check(sessionId, String);
        return instance.invalidateSession(sessionId);
      },
      /**
       * verifyContact - return contact details of active user where token would be sent to
       *
       * @returns {object}  contact details
       */
      [`TokenAffirm:${this.prefix}/verifyContact`]:function verifyContact(){
        return instance.verifyContact();
      },
    });

    // Set DDP rate limits
    let requestTokenRule = {
      userId: this.config.validate,
      type: 'method',
      name: `TokenAffirm:${this.prefix}/requestToken`,
    };
    DDPRateLimiter.addRule(requestTokenRule, this.config.requestCount, this.config.requestInterval);

    let verifyTokenRule = {
      userId: this.config.validate,
      type: 'method',
      name: `TokenAffirm:${this.prefix}/verifyToken`,
    };
    DDPRateLimiter.addRule(verifyTokenRule, this.config.requestCount, this.config.requestInterval);

    let invalidateSessionRule = {
      userId: this.config.validate,
      type: 'method',
      name: `TokenAffirm:${this.prefix}/invalidateSession`,
    };
    DDPRateLimiter.addRule(invalidateSessionRule, this.config.requestCount, this.config.requestInterval);

    let verifyContactRule = {
      userId: this.config.validate,
      type: 'method',
      name: `TokenAffirm:${this.prefix}/verifyContact`,
    };
    DDPRateLimiter.addRule(verifyContactRule, this.config.requestCount, this.config.requestInterval);

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
   * verifyToken - verify a token
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
   * invalidateSession - invalidates a confirmation session
   *
   * @param  {string} sessionId id of session to invalidate
   * @returns {number}           1 if session is successfully invalidated
   */
  invalidateSession(sessionId){
    return this.collection.remove({_id: sessionId});
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
    // TODO: write verifyContact for client-side
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
