$(function(){
    $('.form-signin').bind('submit', function(e)
        {
            e.preventDefault();

            var $submitBtn = $('button', this).ladda();
            $submitBtn.ladda( 'start' );

            var form = this,
            accessKeyId = $('input[name=access-key-id]', form).val(),
            secretAccessKey = $('input[name=secret-access-key]', form).val(),
            rootDirectory = $('input[name=root-directory]', form).val();
            var rds_idx = rootDirectory.indexOf("/");
            if(!rootDirectory || rds_idx === 0)
            {
                alert('Root directory should not be empty');
                $submitBtn.ladda( 'stop' );
                return false;
            }
            if(rds_idx >= 0)
                rootDirectory = rootDirectory.substring(0, rds_idx);
            
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
                           {
                               // clear user info
                               storage.setItem(config.storageAppNameKey, '');
                           }
                           storage.setItem(config.storageAuthKey, JSON.stringify(auth_obj));
                           
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
                                      storage.setItem(config.storageAppNameKey,
                                                      apps[0]);
                                  var dq = path.urlParseQuery(document.location);
                                  document.location = dq.redirect ? 
                                      dq.redirect : 'index.html';
                              })
                       }
                   }

                   $submitBtn.ladda( 'stop' );
                   $('button', form).prop('disabled', false);
               });
            $submitBtn.ladda( 'stop' );
            return false;
        });
});
