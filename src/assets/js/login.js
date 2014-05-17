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
                alert('Root directory should not be empty');
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
                Prefix: rootDirectory + "/",
                MaxKeys: 1
            }, function(err, data)
               {
                   function continue_job()
                   {
                       if(selectedApp)
                           storage.setItem(config.storageAppNameKey,
                                           selectedApp);
                       redirectLoggedInUser();
                   }
                   if(err)
                   {
                       alert("Couldn't connect to aws s3: " + err);
                   }
                   else if(!data || !data.Contents || 
                           data.Contents.length <= 0)
                   {
                       alert("Invalid directory!");
                   }
                   else
                   {
                       if(!storage)
                           alert("This app does not support your browser");
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

                   $submitBtn.ladda( 'stop' );
                   $('button', form).prop('disabled', false);
               });
            return false;
        });
});
function idFedLogin(opts, cb)
{
    /* opts_ex = {
         cred: {
           RoleArn: roleArn, WebIdentityToken: token, ProviderId: providerId
         },
         userId: userId,
         host: host // like 'google.com' || 'facebook.com'
       }
     */
    function testPermission(cb)
    {
        // caller should userId in opts.userId;
        // requests for users directory
        // at end of this method life it will call `cb(err)' and if there is
        var testfile = userDir + '/tf';
        s3.putObject({
            Bucket: config.s3Bucket,
            Key: testfile
        }, function()
           {
               if(err)
                   return cb && cb(err);
               s3.deleteObject({
                   Bucket: config.s3Bucket,
                   Key: testfile
               }, function(err, data)
                  {
                      cb && cb(err);
                  });
           });
    }
    AWS.config.cerdentials = new AWS.WebIdentityCredentials(opts.cred);

    AWS.config.region = config.s3BucketRegion;
    var s3 = new AWS.S3({ region: config.s3BucketRegion, maxRetries: 1 }),
    rootDir = config.idFedS3RootDirectory,
    userDir = rootDir + '/' + opts.userId;
    $('button', form).prop('disabled', true);
    s3.listObjects({
        Bucket: config.s3Bucket,
        Prefix: userDir,
        MaxKeys: 1
    }, function(err, data)
       {
           if(err)
           {
               alert("Couldn't connect to aws s3: " + err);
           }
           else if(!data || !data.Contents || data.Contents.length <= 0)
           {
               testPermission(function(err)
                 {
                     if(err)
                         return cb && cb(err);
                     continue_job();
                 });
           }
           else
               continue_job();
       });
    function continue_job()
    {
        var auth_obj = {
            type: 'idFed',
            host: opts.host,
            cred: opts.cred,
            userId: opts.userId,
            rootDirectory: rootDir
        };
        storage.type = 'local';
        storage.setItem('storage-type', storage_t);
        
        var prevObj = storage.getItem(config.storageAuthKey);
        if(!prevObj || prevObj.host != auth_obj.host || 
           prevObj.userId != auth_obj.userId)
            clearUserStorage(); // clear user info
        storage.setItem(config.storageAuthKey, JSON.stringify(auth_obj));
        storage.setItem(config.singleAppModeKey, "1");
        storage.setItem(config.storageAppNameKey, opts.userId);
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
        var authResp = response.authResponse;
        idFedLogin({
            userId: authResp.userID,
            host: 'facebook.com',
            cred: {
                RoleArn: config.idFedFBUsersRoleArn,
                WebIdentityToken: authResp.accessToken,
                ProviderId: 'graph.facebook.com'
            }
        }, alertIfError);
    }
}
function loggedInGooglePlus(response)
{
    console.log(arguments);
    if(!response.error && 0)
    {
        idFedLogin({
            userId: authResp.userID,
            host: 'google.com',
            cred: {
                RoleArn: config.idFedUsersRoleArn,
                WebIdentityToken: response.id_token
            }
        }, alertIfError);
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
