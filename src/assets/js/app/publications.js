$(function(){

    var appName = storage.getItem(config.storageAppNameKey);
    var publicationsTable = $("#publicationDataTable");

    if (s3AuthObj && awsS3) {

        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: s3AuthObj.rootDirectory + '/'+appName+'/',
                Delimiter: '/'
            },
            function(error, respons) {

                for(var i = 0, l = respons.CommonPrefixes.length; i < l; ++i) {

                    if (isolateFolderName(respons.CommonPrefixes[i].Prefix) == "AAD" ||
                        isolateFolderName(respons.CommonPrefixes[i].Prefix) == "APP__" ||
                        isolateFolderName(respons.CommonPrefixes[i].Prefix) == "APW_") {
                        continue;
                    }

                    addRowToTable(respons.CommonPrefixes[i], publicationsTable);
                }

                awsS3.getObject({
                    Bucket: config.s3Bucket,
                    Key: s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
                }, function(err, data) {
                    if (err)
                        console.log(err, err.stack); // an error occurred
                    else {
                        if ($.plist != undefined)
                            var xmlData = $.plist($.parseXML(data.Body.toString()));

                        for(var i = 0, l = xmlData.length; i < l; ++i) {
                            $("td:contains("+isolateFolderName2(xmlData[i].FileName)+")").closest('td').next().html(xmlData[i].Title).closest('td').next().html(xmlData[i].Subtitle);

                        }
                    }
                });
            });
    }

});

function addRowToTable(data, publicationsTable) {
    publicationsTable.dataTable().fnAddData( [
        isolateFolderName(data.Prefix),
        "",
        "",
        "<a class='btn  btn-primary btn-xs text-center' href='#'>Edit</a>",
        "<a class='btn  btn-success btn-xs text-center' href='#'>Active</a>"]
    );
}

function isolateFolderName(name) {
    return name.replace(s3AuthObj.rootDirectory + '/' + storage.getItem(config.storageAppNameKey) + '/', "").replace("/", "");
}

function isolateFolderName2(name) {
    return name.substring(	name.indexOf("/")+1, name.length-5);
}