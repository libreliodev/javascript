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
                '/APP_/Reports/publications.tsv',
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
               $tbody = $table.find('tbody');
               $tbody.empty();
               for(var i = 0, l = tsv.length; i < l; ++i)
               {
                   var row = tsv[i],
                   tr = $('<tr/>'),
                   tds = [];
                   
                   tds.push(createColumnData('Name', row.Name));
                   tds.push(createColumnData('PaidDownloads', 
                                             row.PaidDownloads));
                   tds.push(createColumnData('FreeDownloads', 
                                             row.FreeDownloads));
                   
                   tr.append(tds);
                   $tbody.append(tr);
               }
           });
        
    }

});
