import { Meteor } from 'meteor/meteor';
import { TokenAffirm } from 'meteor/freelancecourtyard:tokenaffirm';
import { Accounts } from 'meteor/accounts-password';

/*global _TA: true*/
/*global _Accounts: true*/
if (Meteor.isDevelopment) {
  _Accounts = Accounts;
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
