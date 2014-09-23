$(function(){

    var app_name = storage.getItem(config.storageAppNameKey),
    app_dir = get_app_dir(app_name),
    $pubdl_table = $('#publication-downloads-table'),
    pubdl_tableData = $pubdl_table.dataTable({
        "aaSorting": [[ 0, "desc" ]]
    });
    
    if(!app_name)
        return;
    
    awsS3Ready(function()
      {
          updatePublicationDownloadTable(app_dir, $pubdl_table);
      });

    function updatePublicationDownloadTable(app_dir, $table)
    {
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: app_dir + '/APP_/REPORTS/publications_.tsv',
            ResponseContentEncoding: 'utf8'
        }, function(err, res)
           {
               if(err)
               {
                   handleAWSS3Error(err.code == 'NoSuchKey' ? 
                                    _('Analytics data not yet available') : err)
                   return;
               }
               var tsvContent = res.Body.toString(),
               tsv = d3.tsv.parse(tsvContent);
               
               if(!tsv)
               {
                   notifyUserError(err);
                   return;
               }
               
               function columnData(key, val)
               {
                   return $('<td/>').text(val || '').html();
               }
               pubdl_tableData.fnClearTable();
               var columns = [ 'Title', 'Paid Downloads', 'Free Downloads' ];
               console.log("Will populate");
               for(var i = 0, l = tsv.length; i < l; ++i)
               {
                   var row = tsv[i],
                   tds = [];
                   
                   for(var c = 0, cl = columns.length; c < cl; ++c)
                   {
                       var col = columns[c];
                       tds.push(columnData(col, row[col]));
                   }
                   pubdl_tableData.fnAddData(tds, false);
               }
               pubdl_tableData.fnDraw();
           });
        
    }

});
