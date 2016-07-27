import { Meteor } from 'meteor/meteor';
import { TokenAffirm } from 'meteor/freelancecourtyard:tokenaffirm';
import { Accounts } from 'meteor/accounts-base';

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
  if (!Accounts.users.findOne({username: 'u1'})){
    Accounts.createUser({
      username: 'u1',
      password: 'pw',
      profile: {
        TokenAffirm: {
          factor: 'default',
          contact: 'default contact',
        },
      },
    });
  }
}

Meteor.startup(() => {
  // code to run on server at startup
});
