import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';


/**
 * class representing a client-side TokenAffirm instance
 */
export class TokenAffirm {


  /**
   * constructor - create a TokenAffirm instance,
   * server-side must have TokenAffirm instance initialised with same prefix
   * multiple client-side instance may communicate with the same server-side instance
   *
   * @param  {string} prefix      a unique identifier for this instance
   */
  constructor(prefix){
    check(prefix, String);
    this.prefix = prefix;
  }


  /**
   * requestToken - request a confirmation token for user action
   *
   * @param  {function} callback function to call when server returns result
   */
  requestToken(callback){
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/requestToken`, callback);
  }


  /**
   * verifyToken - verify token against a session
   *
   * @param  {string} sessionId id of session to verify
   * @param  {string} token     token used for verification
   * @param  {function} callback  function to call when server returns result
   */
  verifyToken(sessionId, token, callback){
    check(sessionId, String);
    check(token, String);
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/verifyToken`, sessionId, token, callback);
  }

  /**
   * invalidateSession - invalidates a session
   *
   * @param  {string} sessionId id of session to invalidate
   * @param  {function} callback = ()=>{}  optional function to call when server returns result
   */
  invalidateSession(sessionId, callback = ()=>{}){
    check(sessionId, String);
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/invalidateSession`, sessionId, callback);
  }

  /**
   * verifyContact - request contact details of active user when token will be sent to
   *
   * @param  {function} callback function to call when server returns result
   */
  verifyContact(callback){
    check(callback, Function);
    Meteor.call(`TokenAffirm:${this.prefix}/verifyContact`, callback);
  }

}
