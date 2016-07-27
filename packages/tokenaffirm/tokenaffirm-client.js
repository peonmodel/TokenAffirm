import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';

/**
 * class representing a client-side TokenAffirm instance
 */
export class TokenAffirm {

  /**
   * constructor - create a TokenAffirm instance,
   * server-side must have TokenAffirm instance initialised with same identifier
   * multiple client-side instance may communicate with the same server-side instance
   *
   * @param  {string} identifier      a unique identifier for this instance
   */
  constructor(identifier){
    check(identifier, String);
    this.identifier = identifier;
    this.prefix = `TokenAffirm:${this.identifier}`;
    // this.session = null;
  }

  /**
   * requestToken - request a confirmation token for user action, only 1 session
   * may be active at the same time
   *
   * @param  {function} callback function to call when server returns result
   */
  requestToken(callback){
    check(callback, Function);
    Meteor.call(`${this.prefix}/requestToken`, callback);
  }

  /**
   * verifyToken - verify token against a session
   *
   * @param  {string} token     token used for verification
   * @param  {function} callback  function to call when server returns result
   */
  verifyToken(token, callback){
    check(token, String);
    check(callback, Function);
    Meteor.call(`${this.prefix}/verifyToken`, token, callback);
  }

  /**
   * invalidateSession - invalidates a session
   *
   * @param  {function} callback = ()=>{}  optional function to call when server returns result
   */
  invalidateSession(callback = ()=>{}){
    check(callback, Function);
    Meteor.call(`${this.prefix}/invalidateSession`, callback);
  }

  /**
   * verifyContact - request contact details of active user when token will be sent to
   *
   * @param  {function} callback function to call when server returns result
   */
  verifyContact(callback){
    check(callback, Function);
    Meteor.call(`${this.prefix}/verifyContact`, callback);
  }

  /**
   * assertOpenSession - check if there is a session of id awaiting token
   * useful for checking if need to regenerate token
   *
   * @param  {function} callback function to call when server returns result
   */
  assertOpenSession(callback = ()=>{}){
    check(callback, Function);
    Meteor.call(`${this.prefix}/assertOpenSession`, callback);
  }

}
