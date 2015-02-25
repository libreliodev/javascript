$(function()
{
  var app_name = storage.getItem(config.storageAppNameKey),
  app_dir = get_app_dir(app_name),
  auth_key = app_dir + '/APP_/Uploads/authorizations_.plist',
  oauth_origin = 'http://localhost',
  oauth_url = oauth_origin+'/php/admin/oauth.php';
  if(!app_name)
    return;

  awsS3Ready(start);
  function start()
  {
    start_request_for_auth_status();
    $('#auth-gen').click(function()
      {
        $('#auth-status').text('Generating refresh token');
        generate_refresh_token(function(err, refreshToken)
          {
            if(err)
              return notifyUserError(err);
            if(!refreshToken)
            {
              $('#auth-status').text('No refresh token available!');
              return;
            }
            $('#auth-status').text('Storing refresh token');
            request_auth_save({
              refresh_token: refreshToken
            }, function(err)
               {
                 if(err)
                 {
                   notifyUserError(err);
                   $('#auth-status').text('');
                   return;
                 }
                 $('#auth-status').text('Refresh token is available!');
               });
          });
        return false;
      });
  }

  function start_request_for_auth_status()
  {
    $('#auth-status').text('Checking authorization status');
    request_auth(function(err, obj)
      {
        if(err)
        {
          handleAWSS3Error(err);
          $('#auth-status').text('');
          return;
        }
        if(obj.refresh_token)
        {
          $('#auth-status').text('Refresh token is available!');
        }
        else
        {
          $('#auth-status').text('Refresh token does not exists!');
        }
      });
  }
  function request_auth(callback)
  {
    awsS3.getObject({
      Bucket: config.s3Bucket,
      Key: auth_key
    }, function(err, res)
       {
         if(err && err.code != 'NoSuchKey')
         {
           callback(err);
           return;
         }
         try {
           var obj = res ? $.plist($.parseXML(res.Body.toString())) : {};
           callback(undefined, obj);
         } catch(err2) {
           callback('Error parsing: ' + err2);
         }
       });
  }
  
  function request_auth_save(obj, callback)
  {
    var body = $.plist('toString', obj);
    awsS3.putObject({
      Bucket: config.s3Bucket,
      Key: auth_key,
      Body: body,
      CacheControl: 'must-revalidate, max-age=0'
    }, function(err)
       {
         callback && callback(err);
       });
  }

  var authWin, authInterval, authCallback;

  if(window.addEventListener)
    window.addEventListener('message', window_on_message, false);
  else if(window.attachEvent)
    window.attachEvent('onmessage', window_on_message);

  function generate_refresh_token(callback)
  {
    authWin = window.open(oauth_url, oauth_url, 
                          'resizable=yes,scrollbars=yes,' +
                          'width=640,height=480');
    if(authInterval !== undefined)
      clearInterval(authInterval);
    authInterval = setInterval(ask_win_authorized, 100);
    authCallback = function()
    {
      $.ajax({
        url: oauth_url + '?' + querystring.stringify({
          action: 'get',
          key: 'refresh_token'
        }),
        xhrFields: {
          withCredentials: true
        },
        success: function(value)
        {
          callback(undefined, value);
        },
        error: function(xhr, a2, err_text)
        {
          callback(sprintf(_("Couldn't generate access token: %s"),
                           err_text))
        }
      });
    }
  }

  function ask_win_authorized()
  {
    if(authWin)
      authWin.postMessage('isAuthorized', oauth_origin);
  }
  function window_on_message(event)
  {
    if(event.data == 'authorized')
    {
      authWin.close();
      authCallback();
      if(authInterval !== undefined)
      {
        clearInterval(authInterval);
        authInterval = undefined;
      }
    }
  }

});
