import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check, Match } from 'meteor/check';
import { Random } from 'meteor/random';
import { DDPRateLimiter } from 'meteor/ddp-rate-limiter';
import { _ } from 'meteor/underscore';

let defaultConfig = {
  factors: {
    default: {
      send: (contact, token, factor, settings, callback)=>{
        console.log(`token: ${token} sent to ${contact} via ${factor} with settings ${settings}`);
        callback(undefined, 'send success');  // callback takes in (err, res)
      },
      // receive: () => {console.log(`receive function unsupported`);},
      settings: null,
    },
  },
  generate: ()=>Random.id(6),
  validate: ()=>true,
  settings: null,
  timeout: 1000,
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
    // TODO: immutable?
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
       * @returns {string}  session id of confirmation
       */
      [`${prefix}/requestToken`]:function requestToken(){
        let user = Meteor.user();
        if (!user) {throw new Meteor.Error(`login required`);}
        instance.invalidateSession(this.connection.id);
        let notify = get(user, `profile.${instance.config.profile}`);
        check(notify, Match.ObjectIncluding({contact: String, factor: String}));
        let { contact, factor } = notify;
        if (!instance.config.factors[factor]){
          throw new Meteor.Error(`${factor} not supported`);
        }
        return instance.requestToken(this.connection.id, contact, factor);
      },

      /**
       * verifyToken - allow client-side to verify token sent
       *
       * @param  {string} token     token sent to factor
       * @returns {boolean}           true when session is verified
       */
      [`${prefix}/verifyToken`]:function verifyToken(token){
        check(token, String);
        return instance.verifyToken(this.connection.id, token);
      },

      /**
       * invalidateSession - allow client-side to cancel a verification session
       *
       * @returns {number}           1 when session is removed, 0 otherwise
       */
      [`${prefix}/invalidateSession`]:function invalidateSession(){
        return instance.invalidateSession(this.connection.id);
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
       * @returns {boolean }  true if session exist and awaiting token
       */
      [`${prefix}/assertOpenSession`]:function assertOpenSession(){
        return instance.assertOpenSession(this.connection.id);
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
   * @param  {string} connectionId id of session to check
   * @returns {boolean}           true when session is verified
   */
  isVerified(connectionId){
    let session = this.collection.findOne({connectionId: connectionId});
    return !!get(session, 'verifyAt');
  }

  /**
   * requestToken - gets wrapAsync version of requestTokenAsync, behaves synchronously
   *
   * @returns {function}  wrapAsync-ed function
   */
  get requestToken(){
    return Meteor.wrapAsync(this.requestTokenAsync);
  }

  /**
   * requestTokenAsync - request a token to affirm user actions, is asynchronous
   *
   * @param {string} connectionId id used for subsequent queries
   * @param  {string} contact essential contact address, i.e. phone number or email address
   * @param  {string} factor  name of factor, i.e. 'telegram', 'SMS' or 'email'
   * @param {function} callback function to pass to async send method
   */
  requestTokenAsync(connectionId, contact, factor, callback){
    let token = this.generateToken();
    let sessionId = this.createSession(connectionId, token, factor);
    this.sendToken(sessionId, contact, token, factor, (err/*, res*/)=>{
      if (err) {callback(err);}
      else {callback(undefined, true);}
    });
  }

  /**
   * verifyToken - verify a token - session
   *
   * @param  {string} connectionId id of session to verify
   * @param  {string} token     token used to verify session
   * @returns {boolean}           true when session is verified
   */
  verifyToken(connectionId, token){
    let session = this.collection.findOne({connectionId: connectionId, userId: Meteor.user()._id});
    if (!session){return false;}
    if (!!session.verifyAt){return false;}
    if ((new Date() - new Date(session.expireAt)) > 0) {return false;}
    if (session.token !== token) {return false;}
    this.collection.update(session._id, {
      $set: {verifyAt: new Date()},
      $unset: {expireAt: true},
    });
    return true;
  }

  /**
   * invalidateSession - invalidates a confirmation session that is still open
   *
   * @param  {string} id id of session to invalidate
   * @returns {number}           1 if session is successfully invalidated
   */
  invalidateSession(id){
    return (
      this.collection.remove({connectionId: id, verifyAt: {$exists: false}}) ||
      this.collection.remove({_id: id, verifyAt: {$exists: false}})
    );
  }

  /**
   * assertOpenSession - check if there is a session of id awaiting token
   * useful for checking if need to regenerate token
   *
   * @param {string} connectionId id of session to check
   * @returns {boolean }  true if session exist and awaiting token
   */
  assertOpenSession(connectionId){
    let session = this.collection.findOne({connectionId: connectionId, userId: Meteor.user()._id});
    if (!session) {return false;}
    if (!!session.verifyAt) {return false;}  // session is closed
    if ((new Date() - new Date(session.expireAt)) > 0) {return false;}
    return true;
  }

  /**
   * sendToken - sends token via the factor user-defined
   * as the user-defined send function may be asynchronous, so is this
   *
   * @param {string} sessionId id of session to check
   * @param  {string} contact address to send token to
   * @param  {string} token   token used for verification
   * @param  {string} factor  name of factor to sent token via
   * @param {function} callback function to pass to async send method
   */
  sendToken(sessionId, contact, token, factor, callback){
    let method = this.config.factors[factor];
    if (!method) {
      console.error(`error, ${factor} not supported`);
      console.log(`printing token on console, ${token}`);
    }

    // timeout condition in case user-defined function does not call callback
    let timeout = get(method, 'settings.timeout') || this.config.timeout;
    let timerId = Meteor.setTimeout(()=>{
      callback(new Meteor.Error(`sending token to ${contact} via ${factor} timed out`), undefined);
      this.invalidateSession(sessionId);
    }, timeout);

    method.send(contact, token, factor, method.settings, (err, res)=>{
      Meteor.clearTimeout(timerId);
      if (err) {
        if (err instanceof Meteor.Error) {callback(err);}
        else {callback(new Meteor.Error(err));}
      }
      else {callback(undefined, res);}
    });
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
   * @param {string} connectionId id used for subsequent queries
   * @param  {string} token  unique string for verification
   * @param  {string} factor name of method token should be sent via
   * @returns {string}        id of session created
   */
  createSession(connectionId, token, factor){
    return this.collection.insert({
      token,
      factor,
      expireAt: new Date((new Date()).getTime() + this.config.expiry),
      userId: Meteor.user()._id,
      connectionId,
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
