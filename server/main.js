import { Meteor } from 'meteor/meteor';
import { TokenAffirm } from 'meteor/freelancecourtyard:tokenaffirm';
/*global _TA: true*/
if (Meteor.isDevelopment) {
  _TA = new TokenAffirm('startup', {factors: {
    email: {
      send: (contact, token, factor)=>{console.log(contact, token, factor);},
      settings: {},
    },
  }});
}

Meteor.startup(() => {
  // code to run on server at startup
});
