# TokenAffirm

Meteor package to affirm actions of users. Sends a one-time token that user will need to input to confirm their actions. Token will be sent via another messaging platform (factor) that is configurable.

## Install

## Usage

### Setup
```
// creates an instance of TokenAffirm on client and server-side
Affirm = new TokenAffirm('unique-identifier', config);
```
### Client-side
```
// request a confirmation token
Affirm.requestToken((error, session)=>{
  if (error) {throw Meteor.Error('unable request token');}
  else {
    // also send the token via configured factor
    // session is used to match with token for verification purpose
    console.log('session id: '+session);
  }
});

// verify token
Affirm.verifyToken(session, token, (error, isVerified)=>{
  if (error) {console.log('verification failed')}
  else {
    // isVerified is true when token is correct for the session
    console.log('token is verified: '+isVerified);
  }
});  

```
### Server-side
```
// check session had been verified
function resumeUserAction(){
  if (! Affirm.isVerified(sessionId)){
    // not verified
    throw new Meteor.Error(`action not affirmed`);
  } else {
    // continue user actions
  }
}
```

## Configuration
// TODO: give an example

## API
### constructor(prefix, [options]) *server-side*
### constructor(prefix) *client-side*

Instantiate class

#### prefix

Type: ```string``` (*unique for server-side, need to be same as server instance for client-side*)

Unique identifier for instance of TokenAffirm, this string will be used to name the Meteor methods required for client-side communication with server. Multiple client-side instances may communicate with the same server-side instance.

#### options *server-side-only*

**options.factors**

Type: ```object```

Object containing the configurable factors used to send the token.

**options.factors.[*factor_name*]**

Type: ```object```

Object containing the send function used to send the token. *factor_name* is name/type of factor, should be a string for contact method, i.e. 'telegram', 'SMS' or 'email'.

**options.factors.[*factor_name*].send**

Type: ```function(contact, token, factor)```

Default: ```(contact, token, factor)=>{console.log(contact, token, factor)}```

Send function used to send the token

**options.factors.[*factor_name*].settings**

Type: ```object|null|undefined```

Default: ```undefined```

Settings used with send function (*currently unused*)

**generate**

Type: ```function()``` (return string)

Default: ```()=>Random.id(6)```

Generate function for the token, return result should be string

**validate**

Type: ```function(userId)``` (return boolean)

Default: ```(userId)=>true```

Validate function for meteor method, limits user by id who may affirm actions

**settings**

Type: ```object|null|undefined```

Default: ```null```

Settings that may be useful (*currently unused*)

**expiry**

Type: ```integer```

Default: ```5*(60*1000)``` (milliseconds)

How long before verification token expire

**retain**

Type: ```integer```

Default: ```5*(60*1000)``` (milliseconds)

How long to retain verified token

**requestInterval**

Type: ```integer```

Default: ```(10*1000)``` (milliseconds)

How long user must wait before requesting another token and other Meteor methods

**requestCount**

Type: ```integer```

Default: ```1```

How many times user may call Meteor methods within requestInterval

**profile**

Type: ```string```

Default: ```TokenAffirm```

Where contacts details used to send user token is stored within profile

Default is pointing to ```Meteor.user().profile['TokenAffirm']```

### requestToken() *server-side*
### requestToken(callback) *client-side*

Create a session for confirmation with token for active Meteor user. Sends token via another factor and return session id.

**callback** *client-side*

Type: ```function(error, result)```

Callback function to call when Meteor method returns.

*callback.arguments.error*

Type: ```undefined|Meteor.Error```

Is ```undefined``` if meteor method successfully execute, ```Meteor.Error``` otherwise.

*callback.arguments.result*

Type: ```undefined|string```

Is ```undefined``` if meteor method returns ```error```. Is ```sessionId``` of confirmation session created. Meanwhile a token will be sent via another factor.

### verifyToken(sessionId, token) *server-side*
### verifyToken(sessionId, token, callback) *client-side*

Verify user sent the right token for sessionId

**sessionId**

Type: ```string```

Id of confirmation session.

**token**

Type: ```string```

Token to verify session.

**callback** (*client-side-only*)

Type: ```function(error, result)```

Callback function to call when Meteor method returns.

*callback.arguments.error*

Type: ```undefined|Meteor.Error```

Is ```undefined``` if meteor method successfully execute, ```Meteor.Error``` otherwise.

*callback.arguments.result*

Type: ```undefined|boolean```

Is ```undefined``` if meteor method returns ```error```. Is ```true``` if right ```token``` is sent, ```false``` otherwise.

### invalidateSession(sessionId) *server-side*
### invalidateSession(sessionId, callback) *client-side*

Invalidates confirmation session

**sessionId**

Type: ```string```

Id of confirmation session.

**callback** (*client-side-only*)

Type: ```function(error, result)```

Callback function to call when Meteor method returns.

*callback.arguments.error*

Type: ```undefined|Meteor.Error```

Is ```undefined``` if meteor method successfully execute, ```Meteor.Error``` otherwise.

*callback.arguments.result*

Type: ```undefined|boolean```

Is ```undefined``` if meteor method returns ```error```. Is ```1``` if session is invalidated.

### verifyContact() *server-side*
### verifyContact(callback) *client-side*

Verify contact of user used to send token.

**returns** (*server-side-only*)

Type: ```object```

Contact details stored in ```Meteor.user().profile[instance.profile]```. Expects to be ```{contact, factor}```

*returns.factor*

Type: ```string```

The name/type of factor to send token via, i.e. 'email', 'telegram' or 'SMS'.

*returns.contact*

Type: ```string```

The identifier used by factor to send token i.e. email address or phone number.

**callback** (*client-side-only*)

Type: ```function(error, result)```

Callback function to call when Meteor method returns.

*callback.arguments.error*

Type: ```undefined|Meteor.Error```

Is ```undefined``` if meteor method successfully execute, ```Meteor.Error``` otherwise.

*callback.arguments.result*

Type: ```undefined|object```

Is ```undefined``` if meteor method returns ```error```. Is ```{factor, contact}``` otherwise.

*callback.arguments.result.factor*

Type: ```string```

The name/type of factor to send token via, i.e. 'email', 'telegram' or 'SMS'.

*callback.arguments.result.contact*

Type: ```string```

The identifier used by factor to send token i.e. email address or phone number.

### isVerified() *server-side*

Verify that confirmation session has been verified.

**returns**

Type: ```boolean```

`true` if session exists and has been verified, ```false``` otherwise.
