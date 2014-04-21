$(function(){

    var app_name = storage.getItem(config.storageAppNameKey),
    $pubdl_table = $('#publication-downloads-table'),
    pubdl_tableData = $pubdl_table.dataTable();
    
    if(!app_name)
        return;
    updatePublicationDownloadTable(app_name, $pubdl_table);

    function updatePublicationDownloadTable(app_name, $table)
    {
        awsS3.getObject({
            Bucket: config.s3Bucket,
            Key: s3AuthObj.rootDirectory + '/' + app_name + 
                '/APP_/REPORTS/publications_.tsv',
            ResponseContentEncoding: 'utf8'
        }, function(err, res)
           {
               if(err/* && err.code != 'NoSuchKey'*/)
               {
                   handleAWSS3Error(err)
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
               var columns = [ 'Title', 'Sample Downloads', 'Paid downloads' ];
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
