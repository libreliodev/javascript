$(function(){

    var appName = storage.getItem(config.storageAppNameKey);
    var publicationsTable = $("#publicationDataTable");

    if (s3AuthObj && awsS3) {

        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: s3AuthObj.rootDirectory + '/'+appName+'/',
                Delimiter: '/'
            },
            function(error, apps) {

                var appsList = apps.CommonPrefixes;

                awsS3.getObject({
                    Bucket: config.s3Bucket,
                    Key: s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
                }, function(err, activated) {

                    var appsList = apps.CommonPrefixes;
                    var activeList = $.plist($.parseXML(activated.Body.toString()));
                    var rowsList = [];
                    var temp = {};
/*console.log(appsList[2]);
console.log(appsList[3]);
console.log(appsList[4]);
console.log(activeList[0]);
console.log(activeList[1]);
console.log(activeList[2]);*/
                    for(var i = 0; i < appsList.length; ++i) {

                        if (isolateFolderName(appsList[i].Prefix) == "AAD" ||
                            isolateFolderName(appsList[i].Prefix) == "APP__" ||
                            isolateFolderName(appsList[i].Prefix) == "APW_") {
                            continue;
                        }

                        temp[i] = {};
                        temp[i].FolderName = isolateFolderName(appsList[i].Prefix);
                        temp[i].id = i;

                        for(var j = 0; j < activeList.length; ++j) {
                            if (isolateFolderName2(activeList[j].FileName) == temp[i].FolderName) {
                                temp[i].Title = activeList[j].Title;
                                temp[i].Subtitle = activeList[j].Subtitle;
                                temp[i].status = "active";
                                temp[i].statusBtn = "<a class='btn  btn-danger btn-xs text-center btnInactive' href='#'>Inactive</a>";
                            }

                            if (temp[i].Title == undefined) {
                                temp[i].Title = "";
                                temp[i].Subtitle = "";
                                temp[i].status = "inactive";
                                temp[i].statusBtn = "<a class='btn  btn-success btn-xs text-center btnActive' href='#'>Active</a>";
                            }
                        }

                        rowsList.push(temp[i]);
                    }

                    for(var i = 0; i < rowsList.length; ++i) {
                        addRowToTable(rowsList[i], publicationsTable);
                    }

                    activeDeactiveEvents();
                });
            });
    }

});

function activeDeactiveEvents() {

    $("a.btnActive").bind("click", function(e) {
        e.preventDefault();

        var some_html = '<div class="form-group"> ' +
                            '<label class="control-label col-lg-4">Title</label> ' +
                            '<div class="col-lg-8"> ' +
                                '<input type="text" /> ' +
                            '</div> ' +
                        '</div>';
        some_html += '<div class="form-group"> ' +
                        '<label class="control-label col-lg-4">Subtitle</label> ' +
                        '<div class="col-lg-8"> ' +
                        '<input type="text" /> ' +
                        '</div> ' +
                    '</div>';
        bootbox.alert(some_html);

    });

    $("a.btnInactive").bind("click", function(e) {
        e.preventDefault();

        bootbox.dialog({
            message: "Are you sure you want to inactive this publication?",
            title: "Confirmation",
            className: "littleModal",
            buttons: {
                success: {
                    label: "Confirm",
                    className: "btn-success",
                    callback: function() {
                        alert(1);
                    }
                },
                danger: {
                    label: "Cancel",
                    className: "btn-danger",
                    callback: function() {
                        alert(0);
                    }
                }
            }
        });

    });
}

function activePublication() {

}

function deactivePublication() {

}

function addRowToTable(data, publicationsTable) {

    publicationsTable.dataTable().fnAddData( [
        data.FolderName,
        data.Title,
        data.Subtitle,
        "<a class='btn  btn-primary btn-xs text-center' href='#'>Edit</a>",
        data.statusBtn]
    );
}

function isolateFolderName(name) {
    return name.replace(s3AuthObj.rootDirectory + '/' + storage.getItem(config.storageAppNameKey) + '/', "").replace("/", "");
}

function isolateFolderName2(name) {
    return name.substring(	name.indexOf("/")+1, name.length-5);
}