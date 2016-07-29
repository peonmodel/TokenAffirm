/* jshint node: true */
/* jshint expr: true*/
'use strict';

import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { Random } from 'meteor/random';

import { chai } from 'meteor/practicalmeteor:chai';
import { describe, it, xdescribe, xit } from 'meteor/practicalmeteor:mocha';
// import { sinon } from 'meteor/practicalmeteor:sinon';
import { TokenAffirm } from 'meteor/freelancecourtyard:tokenaffirm';

let expect = chai.expect;
chai.config.truncateThreshold = 0;
xdescribe('x', function(){});  // just to ignore the jshint not used error
xit('x', function(){});


/**
 * Helper function to compare nest objects recursively
 * it IGNORES functions
 * stringifying functions would not work as it includes
 * source mappping comments
 */
function compareObjectsByEachKey(o1, o2, ordered = true){
  expect(o1).to.be.an('object');
  expect(o2).to.be.an('object');
  let arr = ordered ? Object.keys(o1) : Object.keys.sort();
  expect(arr.length).to.equal(Object.keys(o2).length);
  arr.forEach((key)=>{
    let xx = o1[key];
    let yy = o2[key];
    if (typeof xx === 'object' && xx !== null){
      compareObjectsByEachKey(xx, yy);
    } else {
      if (typeof xx !== 'function') {
        expect(xx).to.deep.equal(yy);
      }
      // gave up comparing 2 different functions, toString includes comments
    }
  });
}

describe('TokenAffirm', function(){

  let subject = new TokenAffirm('test');

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

  describe('constructor', function(){

    it('should check identifier is string', function(){
      expect(function(){new TokenAffirm();}).to.throw('');
    });

    it('should set default configuration', function(){
      compareObjectsByEachKey(subject.config, defaultConfig);
    });

    it('should create collection', function(){
      expect(subject.collection).to.be.instanceof(Mongo.Collection);
      expect(subject.collection._collection.name).to.equal(this.collectionName);
      expect(subject.collectionName.startsWith('TokenAffirm:test:Collection')).to.be.true;
    });

    xdescribe('collection async expiry (disabled, see comments, TL;DR need to wait > 1 min)', function(){
      // code is disabled as Mongo TTL updates infrequently, about
      // once every 1 min, so the wait time required to reliably pass
      // test needs to be > 1 min and Mocha runs the async tests in series...
      this.timeout(120000);  // 2 mins

      it('should remove verified items after 5 mins (retain)', function(done){
        // add item verified 5 mins - 1 second
        let fiveMinsAgo = new Date(new Date().getTime() - 5*60*1000 + 1000);
        let item = subject.collection.insert({verifyAt: fiveMinsAgo});
        this.timeout(120000);  // increase timeout limit
        Meteor.setTimeout(function(){
          // have not yet remove after 0.5s
          expect(subject.collection.findOne(item)).to.deep.equal({_id: item, verifyAt: fiveMinsAgo});
          Meteor.setTimeout(function(){
            // should be removed
            try {
              expect(subject.collection.findOne(item)).to.be.undefined;
              done();
            } catch(e){
              done(e);
            }
          }, 100000);
        }, 500);
      });

      it('should remove expired items', function(done){
        // add item expiring in 1 second
        let oneSecondLater = new Date(new Date().getTime() + 1000);
        let item = subject.collection.insert({expireAt: oneSecondLater});
        this.timeout(120000);  // increase timeout limit
        Meteor.setTimeout(function(){
          // have not yet remove after 0.5s
          expect(subject.collection.findOne(item)).to.deep.equal({_id: item, expireAt: oneSecondLater});
          Meteor.setTimeout(function(){
            // should be removed
            try {
              expect(subject.collection.findOne(item)).to.be.undefined;
              done();
            } catch(e){
              done(e);
            }
          }, 100000);
        }, 500);
      });
    });

  });

});
