import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

export class TokenAffirm {
  constructor(prefix){
    check(prefix, String);
    this.prefix = prefix;
  }
  requestToken(callback){
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/requestToken`, callback);
  }

  verifyToken(sessionId, token, callback){
    check(sessionId, String);
    check(token, String);
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/verifyToken`, sessionId, token, callback);
  }

  invalidateSession(sessionId, callback){
    check(sessionId, String);
    check(callback, Match.Maybe(Function));
    Meteor.call(`TokenAffirm:${this.prefix}/invalidateSession`, sessionId, callback);
  }
}
