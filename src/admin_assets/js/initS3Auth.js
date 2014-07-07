var s3AuthObj,
awsS3;
if(!storage)
    alert(_("This app does not support your browser"));
else
{
    storage.type = 'local';
    storage.type = storage.getItem('storage-type') || 'session';
    try {
        s3AuthObj = JSON.parse(storage.getItem(config.storageAuthKey));
    }catch(e) {
        s3AuthObj = null;
    }
    if(!s3AuthObj)
    {
        $('body > *').hide();
        redirectToLogin();
    }
    else
    {
        if(s3AuthObj.type == 'idFed')
        {
            switch(s3AuthObj.host)
            {
            case 'plus.google.com':
                // insert gapi script
                (function() {
                    var po = document.createElement('script'); po.type = 'text/javascript'; po.async = true;
                    po.src = 'https://apis.google.com/js/client:plusone.js?onload=gapi_loaded';
                    var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(po, s);
                })();
                window.gapi_loaded = function()
                {
                    var gbtn_id = '_googleplus_btn',
                    gbtn_el = $('<div/>')
                        .prop('id', gbtn_id)
                        .appendTo($('<div/>').appendTo('body')
                                  .css('display', 'none'))
                        .append($('<div/>').html('Login'));
                    
                    gapi.signin.render(gbtn_id, {
                        clientid: config.idFedGPAppId,
                        cookiepolicy : 'single_host_origin',
                        scope: 'https://www.googleapis.com/auth/plus.login',
                        callback: '_google_plus_login_status'
                    });
                    window._google_plus_login_status = function(response)
                    {
                        if(!response.error &&
                           response.status.signed_in)
                        {
                            idFedLoggedIn(response.id_token);
                        }
                        else
                        {
                            // logout
                            userLogout();
                            redirectToLogin();
                        }
                    }
                }
                break;
            case 'facebook.com':
                // insert facebook script
                $(function(){
                    $('<div/>').prop('id', 'fb-root')
                        .appendTo('body');
                    (function(d, s, id) {
                        var js, fjs = d.getElementsByTagName(s)[0];
                        if (d.getElementById(id)) return;
                        js = d.createElement(s); js.id = id;
                        js.src = "//connect.facebook.net/en_US/sdk.js#xfbml=1&appId=" + config.idFedFBAppId + "&version=v2.0";
                        fjs.parentNode.insertBefore(js, fjs);
                    }(document, 'script', 'facebook-jssdk'));
                });
                window.fbAsyncInit = function()
                {
                    FB.getLoginStatus(function(response)
                      {
                          if(response.status == 'connected')
                          {
                              idFedLoggedIn(response.authResponse.accessToken);
                          }
                          else
                          {
                              // logout
                              userLogout();
                              redirectToLogin();
                          }
                      })
                }
                break;
            }
        }
        else
        {
            AWS.config.update({
                accessKeyId: s3AuthObj.accessKeyId,
                secretAccessKey: s3AuthObj.secretAccessKey
            });
            AWS.config.region = config.s3BucketRegion;
            awsS3 = new AWS.S3({ region: config.s3BucketRegion });
        }
    }
}
function idFedLoggedIn(token)
{
    var cred = s3AuthObj.cred;
    cred.WebIdentityToken = token;
    AWS.config.credentials = new AWS.WebIdentityCredentials(s3AuthObj.cred);
    
    AWS.config.region = config.s3BucketRegion;
    awsS3 = new AWS.S3({ region: config.s3BucketRegion });
    $(document).trigger('awsS3Initialized');
}
