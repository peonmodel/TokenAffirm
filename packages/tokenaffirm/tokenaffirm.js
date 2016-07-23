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

export class TokenAffirm {

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

  defineMethods(prefix){
    this.prefix = prefix;
    let instance = this;
    Meteor.methods({
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
      [`TokenAffirm:${this.prefix}/verifyToken`]:function verifyToken(sessionId, token){
        check(sessionId, String);
        check(token, String);
        return instance.verifyToken(sessionId, token);
      },
      [`TokenAffirm:${this.prefix}/invalidateSession`]:function invalidateSession(sessionId){
        check(sessionId, String);
        return instance.invalidateSession(sessionId);
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
  }

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

  isVerified(sessionId){
    let session = this.collection.findOne({_id: sessionId});
    return !!get(session, 'verifyAt');
  }

  requestToken(contactAddress, contactMethod){
    let token = this.generateToken();
    let sessionId = this.createSession(token, contactMethod);
    this.sendToken(contactAddress, token, contactMethod);
    return sessionId;
  }

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

  invalidateSession(sessionId){
    return this.collection.remove({_id: sessionId});
  }

  sendToken(contact, token, factor){
    let method = this.config.factors[factor];
    if (!method) {
      console.error(`error, ${factor} not supported`);
      console.log(`printing token on console, ${token}`);
    }
    return method.send(contact, token, factor);
  }

  generateToken(){
    return this.config.generate();
  }

  createSession(token, factor){
    return this.collection.insert({
      token,
      factor,
      expireAt: new Date((new Date()).getTime() + this.config.expiry),
      user: Meteor.user()._id,
    });
  }
}

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
