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

## API
### constructor(prefix, [options]) *server-side*

Instantiate class on server-side

#### prefix

Type: ```string``` (*unique*)

Unique identifier for instance of TokenAffirm, this string will be used to name the Meteor methods required for client-side communication with server.

#### options

**options.factors**

Type: ```object```

Object containing the configurable factors used to send the token

**options.factors.[*factor_name*]**

Type: ```object```

Object containing the send function used to send the token

**options.factors.[*factor_name*].send**

Type: ```function``` (with params: [```contact```, ```token```, ```factor```])

Default: ```(contact, token, factor)=>{console.log(contact, token, factor)}```

Send function used to send the token

**options.factors.[*factor_name*].settings**

Type: ```object|null|undefined```

Default: ```undefined```

Settings used with send function (*currently unused*)

**generate**

Type: ```function``` (return string)

Default: ```()=>Random.id(6)```

Generate function for the token, return result should be string

**validate**

Type: ```function``` (return boolean)

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

### constructor(prefix, [options]) *client-side*

Instantiate class on client-side

#### prefix

Type: ```string``` (need to be the same as server instance)

String used to communicate with server-side TokenAffirm instance

### requestToken() *server-side*

Create a session for confirmation with token for active Meteor user. Sends token via another factor and return session id.

### requestToken(callback) *client-side*

Request a confirmation token from server.

**callback**

Type: ```function```

Callback function will be called with (```error```, ```sessionId```). ```error``` will be Meteor.Error if request failed, otherwise ```error``` is undefined and ```sessionId``` is returned. Meanwhile a token will be sent via another factor.

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

Type: ```function```

Callback function will be called with (```error```, ```verified```). ```error``` will be Meteor.Error if request failed, otherwise ```error``` is undefined and ```verified``` is returned. ```verified``` is ```true``` if the right token is sent, ```false``` otherwise.
