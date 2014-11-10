$(function(){

    var app_name = storage.getItem(config.storageAppNameKey),
    app_dir = get_app_dir(app_name),
    $messages_table = $('#dataTable'),
    messages_tableData = $messages_table.dataTable();
    if(!app_name)
        return;
    

    awsS3Ready(function()
      {
        updateMessagesSentTable(app_name, $messages_table, messages_tableData);

        $("#notification-form input[type=submit]").click(function()
          {
            return confirm(_("Are you sure you want to send this message?"));
          });
        $("#notification-form").bind('submit', function()
         {

           var form = this;

           // Loading animation on click
           var $submitBtn = $('button', form).ladda();
           $submitBtn.ladda( 'start' );

           $('input[type=submit]', form).prop('disabled', true);
           var sns = new AWS.SNS(),
           publisher_name = s3AuthObj.rootDirectory,
           app_name = storage.getItem(config.storageAppNameKey),
           msg = $('#message-textarea').val();

           if(!app_name)
           {
               alert(_("Please select application before sending notification"));
           }
           else if(msg == '' || msg.length > 300)
           {
               alert(_("Message box is empty or is to long, "+
                       "it should be less or equal than 300"));
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
                          alert(_("Message sent!"));
                      $('input[type=submit]', form).prop('disabled', false);

                      // Stop loading animation
                      $submitBtn.ladda( 'stop' );
                  });
           }
           return false;
         });

      });
    
    function updateMessagesSentTable(app_name, $table, tableData)
    {
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/APP_/REPORTS/push_.tsv',
            ResponseContentEncoding: 'utf8'
        }, function(err, res)
           {
               if(err && err.code != 'NoSuchKey')
               {
                   handleAWSS3Error(err)
                   return;
               }
               var tsvContent = res ? res.Body.toString() : '',
               tsv = tsvContent ? d3.tsv.parse(tsvContent) : [];
               
               if(!tsv)
               {
                   notifyUserError(err);
                   return;
               }
               function columnData(key, val)
               {       
                   return $('<td/>').text(val || '').html();
               }
               var columns = [ 'Date', 'Message', 'Quantity' ];
               tableData.fnClearTable();
               for(var i = 0, l = tsv.length; i < l; ++i)
               {
                   var row = tsv[i],
                   tds = [];
                   
                   for(var c = 0, cl = columns.length; c < cl; ++c)
                   {
                       var col = columns[c];
                       tds.push(columnData(col, row[col]));
                   }
                   tableData.fnAddData(tds, false);
               }
               tableData.fnDraw();
           });
    }
});
