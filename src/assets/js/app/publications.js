$(function(){

    var appName = storage.getItem(config.storageAppNameKey);
    var publicationsTable = $("#dataTable");

    if (s3AuthObj && awsS3) {

        awsS3.getObject({
                Bucket: config.s3Bucket,
                Key: 'developer/sportguide/Magazines.plist'
            },
            function(error, respons) {
                console.log(respons);
            });

        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: s3AuthObj.rootDirectory + '/'+appName+'/',
                Delimiter: '/'
            },
            function(error, respons) {
                //console.log(respons);

                for(var i = 0, l = respons.CommonPrefixes.length; i < l; ++i) {

                    if (isolateFolderName(respons.CommonPrefixes[i].Prefix) == "AAD" ||
                        isolateFolderName(respons.CommonPrefixes[i].Prefix) == "APP__" ||
                        isolateFolderName(respons.CommonPrefixes[i].Prefix) == "APW_") {
                        continue;
                    }

                    addRowToTable(respons.CommonPrefixes[i]);
                }

            });

    }

    function addRowToTable(data) {
        publicationsTable.dataTable().fnAddData( [
            isolateFolderName(data.Prefix),
            "",
            "" ]
        );
    }

    function isolateFolderName(name) {
        return name.replace(s3AuthObj.rootDirectory + '/' + appName + '/', "").replace("/", "");
    }
});