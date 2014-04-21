$(function(){

    var app_name = storage.getItem(config.storageAppNameKey),
    $pubdl_table = $('#pubiction-downloads-table');
    
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
               
               function createColumnData(key, val)
               {       
                   return $('<td/>').text(val || '')[0];
               }
               console.log(tsv);
               $tbody = $table.find('tbody');
               $tbody.empty();
               var columns = [ 'Title', 'Sample Downloads', 'Paid downloads' ];
               for(var i = 0, l = tsv.length; i < l; ++i)
               {
                   var row = tsv[i],
                   tr = $('<tr/>'),
                   tds = [];
                   
                   for(var c = 0, cl = columns.length; c < cl; ++c)
                   {
                       var col = columns[c];
                       tds.push(createColumnData(col, row[col]));
                   }
                   
                   tr.append(tds);
                   $tbody.append(tr);
               }
           });
        
    }

});
