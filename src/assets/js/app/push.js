$(function(){
    $("#notification-form input[type=submit]").click(function()
        {
            return confirm("Are you sure you want to send this message?");
        });
    $("#notification-form").bind('submit', function()
       {

           var form = this;

<<<<<<< HEAD
           // Loading animation on click
           var $submitBtn = $('button', form).ladda();
           $submitBtn.ladda( 'start' );
=======
           if ($('input[type=submit]', form).hasClass("loadingAnimation")) {
               var oldValue = $('input[type=submit]', form).attr("value");
               $('input[type=submit]', form).attr("value", "Loading...")
           }
>>>>>>> ce2109833c6326ea8b0e1ef65a442438ddb9f014

           $('input[type=submit]', form).prop('disabled', true);
           var sns = new AWS.SNS(),
           publisher_name = s3AuthObj.rootDirectory,
           app_name = storage.getItem(config.storageAppNameKey),
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

<<<<<<< HEAD
                      // Stop loading animation
                      $submitBtn.ladda( 'stop' );
=======
                      if ($('input[type=submit]', form).hasClass("loadingAnimation")) {
                          $('input[type=submit]', form).attr("value", oldValue);
                      }
>>>>>>> ce2109833c6326ea8b0e1ef65a442438ddb9f014
                  });
           }
           return false;
       });
});
