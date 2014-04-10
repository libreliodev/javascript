$(function(){
    $("#notification-form input[type=submit]").click(function()
        {
            return confirm("Are you sure you want to send this message?");
        });
    $("#notification-form").bind('submit', function()
       {
           var form = this;
           $('input[type=submit]', form).prop('disabled', true);
           var sns = new AWS.SNS(),
           publisher_name = s3AuthObj.rootDirectory,
           app_name = localStorage.getItem(config.localStorageAppNameKey),
           msg = $('#message-textarea').val();

           if(!app_name)
           {
               alert("Please select application before sending notification");
           }
           else if(msg == '' || msg.length > 300)
           {
               alert("Message box is empty or is to long, "+
                     "it should be less or equal than 300");
           }
           else
           {
               sns.publish({
                   TargetArn: 'arn:aws:sns:eu-west-1:105216790221:' + 
                       publisher_name + '_' + app_name + '_all',
                   MessageStructure: 'json',
                   Message: JSON.stringify({
                       "default": msg,
                       "APNS": JSON.stringify({
                           "aps": {
                               "alert": msg,
                               "sound": "default"
                           }
                       }),
                       "GCM": JSON.stringify({
                           "data": {
                               "message": msg
                           }
                       }),
                       
                   })
               }, function(err, res)
                  {
                      if(err)
                          alert(err);
                      else
                          alert("Message sent!");
                      $('input[type=submit]', form).prop('disabled', false);
                  });
           }
           return false;
       });
});
