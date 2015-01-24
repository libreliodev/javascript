$(function(){
    $('.form-signin').bind('submit', function(e)
        {
            e.preventDefault();

            var $submitBtn = $('button', this).ladda();
            $submitBtn.ladda( 'start' );

            var form = this,
            accessKeyId = $('input[name=access-key-id]', form).val(),
            secretAccessKey = $('input[name=secret-access-key]', form).val(),
            rootDirectory = $('input[name=root-directory]', form).val(),
            selectedApp;
            var rds_idx = rootDirectory.indexOf("/");
            if(!rootDirectory || rds_idx === 0)
            {
                alert(_('Root directory should not be empty'));
                $submitBtn.ladda( 'stop' );
                return false;
            }
            if(rds_idx >= 0)
            {
                selectedApp = rootDirectory.substr(rds_idx + 1);
                rootDirectory = rootDirectory.substring(0, rds_idx);
            }
            AWS.config.update({
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            });
            AWS.config.region = config.s3BucketRegion;
            var s3 = new AWS.S3({ region: config.s3BucketRegion, maxRetries: 1 }),
            bucket = config.s3Bucket;
            $('button', form).prop('disabled', true);
            s3.listObjects({
                Bucket: bucket,
                Prefix: rootDirectory + "/" + 
                    (selectedApp ? selectedApp + '/' : ''),
                MaxKeys: 1
            }, function(err, data)
               {
                   function continue_job()
                   {
                       if(selectedApp)
                           storage.setItem(config.storageAppNameKey,
                                           selectedApp);
                       $submitBtn.ladda( 'stop' );
                       redirectLoggedInUser();
                   }
                   if(err)
                   {
                       $submitBtn.ladda( 'stop' );
                       alert(_("Couldn't connect to aws s3") + ": " + err);
                   }
                   else if(!data || !data.Contents || 
                           data.Contents.length <= 0)
                   {
                       $submitBtn.ladda( 'stop' );
                       alert(_("Invalid directory!"));
                   }
                   else
                   {
                       if(!storage)
                           alert(_("This app does not support your browser"));
                       else
                       {
                           var auth_obj = {
                               method: 'main',
                               accessKeyId: accessKeyId,
                               secretAccessKey: secretAccessKey,
                               rootDirectory: rootDirectory
                           };
                           storage.type = 'local';
                           var storage_t = $('#remember-me').prop('checked') ?
                               'local' : 'session';
                           storage.setItem('storage-type', storage_t);
                           
                           storage.type = storage_t;
                           var prevObj = storage.getItem(config.storageAuthKey);
                           if(!prevObj || prevObj.accessKeyId != accessKeyId) 
                               clearUserStorage(); // clear user info
                           storage.setItem(config.storageAuthKey, JSON.stringify(auth_obj));
                           if(selectedApp)
                           {
                               storage.setItem(config.singleAppModeKey, "1");
                               continue_job();
                           }
                           else
                           {
                               /* select default app before redirect! */
                               s3ListDirectories(s3, {
                                   Bucket: config.s3Bucket,
                                   Prefix: auth_obj.rootDirectory + '/'
                               }, function(err, apps)
                                  {
                                  if(err)
                                  {
                                      alert(err);
                                      return;
                                  }
                                  if(apps.length > 0)
                                      selectedApp = apps[0];
                                  continue_job();
                              })
                           }
                       }
                   }

                   $('button', form).prop('disabled', false);
               });
            return false;
        });
    // social network authentication starts
    $('.oauth2-wrp > a').click(function()
         {
             var $this = $(this);
             if($this.data('inProcess'))
                 return false;
             $this.data('inProcess', true);
             try {
                 if($this.hasClass('fb-signin-btn'))
                 {
                     FB.login(function(response)
                              {
                                  $this.data('inProcess', false);
                                  loggedInFacebook(response);
                              }, { scope: 'email' })
                 }
                 else if($this.hasClass('gp-signin-btn'))
                 {
                     gapi.auth.signIn({
                         clientid: config.GoogleClientId,
                         cookiepolicy : 'single_host_origin',
                         scope: 'email',
                         approvalprompt: 'force',
                         callback: 'loggedInGooglePlus'
                     });
                 }
             }catch(e) {
                 $this.data('inProcess', false);
             }
             return false;
         });
});
function idFedLogin(opts, cb)
{
    /* opts_ex = {
         cred: {
           RoleArn: roleArn, WebIdentityToken: token, ProviderId: providerId
         },
         host: host,
         userDirname: userDirname
       }
     */
    function testPermissionAndPutUserInfo(cb)
    {
        // caller should userId in opts.userId;
        // requests for users directory
        // at end of this method life it will call `cb(err)' and if there is
        s3.putObject({
            Bucket: config.s3Bucket,
            Key: userDir + '/' + app_name + '/APP_/user_.txt',
            Body: JSON.stringify({
                firstname: opts.firstname,
                lastname: opts.lastname,
                email: opts.email
            }, null, "  ")
        }, function(err)
           {
               cb && cb(err);
           });
    }
    AWS.config.credentials = new AWS.WebIdentityCredentials(opts.cred);
    AWS.config.region = config.s3BucketRegion;

    var s3 = new AWS.S3({ region: config.s3BucketRegion, maxRetries: 1 }),
    app_name = config.idFedDefaultApp,
    userDir = opts.userDirname;
    testPermissionAndPutUserInfo(function(err)
        {
            if(err)
                return cb && cb(err);
            continue_job();
        });
    function continue_job()
    {
        var auth_obj = {
            type: 'idFed',
            cred: opts.cred,
            host: opts.host,
            rootDirectory: userDir
        };
        storage.type = 'local';
        storage.setItem('storage-type', 'local');
        
        var prevObj = storage.getItem(config.storageAuthKey);
        if(!prevObj || prevObj.userDirname != auth_obj.userDirname)
            clearUserStorage(); // clear user info
        storage.setItem(config.storageAuthKey, JSON.stringify(auth_obj));
        storage.setItem(config.storageAppNameKey, app_name);
        redirectLoggedInUser();
        cb && cb();
    }
}
function alertIfError(err)
{
    if(err)
        alert(err);
}
function loggedInFacebook(response)
{
    if(response.status == 'connected')
    {
        FB.api('me', 'get', {
          
        }, function(userInfo)
           {
               var authResp = response.authResponse;
               idFedLogin({
                   userDirname: config.idFedFBUserDirnamePrefix + 
                       authResp.userID,
                   firstname: userInfo.first_name,
                   lastname: userInfo.last_name,
                   email: userInfo.email,
                   host: 'facebook.com',
                   cred: {
                       RoleArn: config.idFedFBUsersRoleArn,
                       WebIdentityToken: authResp.accessToken,
                       ProviderId: 'graph.facebook.com'
                   }
               }, alertIfError);
           });
    }
}
function loggedInGooglePlus(response)
{
    if(!response.error && response.status.signed_in)
    {
        gapi.client.load('plus', 'v1', function()
           {
               gapi.client.plus.people.get({ 'userId': 'me' })
                   .execute(function(userInfo)
                  {
                      if(!userInfo.id)
                      {
                          alert(_("Couldn't get users info!"))
                          return;
                      }
                      var name_obj = userInfo.name || {};
                      idFedLogin({
                          userDirname: config.idFedGPUserDirnamePrefix + 
                              userInfo.id,
                          firstname: name_obj.givenName || '',
                          lastname: name_obj.familyName || '',
                          email: userInfo.emails && userInfo.emails.length > 0 ?
                              userInfo.emails[0].value : '',
                          host: 'plus.google.com',
                          cred: {
                              RoleArn: config.idFedGPUsersRoleArn,
                              WebIdentityToken: response.id_token
                          }
                      }, function(err)
                         {
                             if(err)
                             {
                                 alert(err);
                                 document.location.reload();
                             }
                         });
                  });
           });
    }
}
function redirectLoggedInUser()
{
    var dq = path.urlParseQuery(document.location);
    document.location = dq.redirect ? dq.redirect : 'index.html';
}
function clearUserStorage()
{
    storage.setItem(config.storageAppNameKey, '');
    storage.setItem(config.singleAppModeKey, '');
}
