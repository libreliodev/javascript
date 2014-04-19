$(function() {

    var appName = storage.getItem(config.storageAppNameKey);
    var publicationsTable = $(".publicationDataTable").dataTable();
    //publicationsTable.fnSort( [ [1,'asc'] ] );

    if (s3AuthObj && awsS3) {

        s3ListAllObjects(awsS3, {
                Bucket: config.s3Bucket,
                Prefix: s3AuthObj.rootDirectory + '/'+appName+'/',
                Delimiter: '/'
            },
            function(error, apps) {

                awsS3.getObject({
                    Bucket: config.s3Bucket,
                    Key: s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
                }, function(err, activated) {

                    var appsList = apps.CommonPrefixes;
                    var activeList =  PlistParser.parse($.parseXML(activated.Body.toString()));

                    activeList = deleteFromObject(activeList, undefined);
                    var activeListLength = $.map(activeList, function(n, i) { return i; }).length;

                    var rowsList = [];
                    var temp = {};
                    var count = 0;

                    for(var i = 0; i < appsList.length; ++i) {

                        //---------------------------------------------------
                        // We have 3 unwanted folders...
                        // ignore them and don't show them on the list
                        //---------------------------------------------------

                        if (isolateFolderName(appsList[i].Prefix) == "AAD" ||
                            isolateFolderName(appsList[i].Prefix) == "APP__" ||
                            isolateFolderName(appsList[i].Prefix) == "APW_") {
                            continue;
                        }

                        //---------------------------------------------------
                        // Prepear a single row object with default value
                        //---------------------------------------------------

                        temp[count] = {
                            FolderName: isolateFolderName(appsList[i].Prefix),
                            Title: "",
                            Subtitle: "",
                            status: "inactive",
                            statusBtn: "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' class='btn  btn-success btn-xs text-center btnActive' href='#'>Active</a>",
                            id: 0
                        }

                        for(var j = 0; j < activeListLength; ++j) {

                            //---------------------------------------------------
                            // There sometimes undefined keys is the object...
                            // it cause because of inactive publications...
                            // it's shouldn't happen, but we do taking
                            // care of it, so the front end user wont have any
                            // errors... jus in case...
                            //---------------------------------------------------

                            /*if (activeList[j] == undefined) {
                             continue;
                             }*/

                            //---------------------------------------------------
                            // Does the folder name fit each other?
                            // if so update this publication title, subtitle
                            // and status
                            //---------------------------------------------------

                            if (isolateFolderName2(activeList[j].FileName) == temp[count].FolderName) {
                                temp[count].Title = activeList[j].Title;
                                temp[count].Subtitle = activeList[j].Subtitle;
                                temp[count].status = "active";
                                temp[count].statusBtn = "<a data-filename='" + isolateFolderName(appsList[i].Prefix) + "' data-id='" + j + "' class='btn  btn-danger btn-xs text-center btnInactive' href='#'>Inactive</a>";
                                temp[count].id = j;
                                break;
                            }
                        }

                        rowsList.push(temp[count]);
                        count++;
                    }

                    //---------------------------------------------------
                    // Add the rows to the table
                    //---------------------------------------------------

                    for(var i = 0; i < rowsList.length; ++i) {
                        addRowToTable(rowsList[i], publicationsTable);
                    }

                    //---------------------------------------------------
                    // Apply events for the active/inactive buttons
                    //---------------------------------------------------

                    activeInactiveEvents(publicationsTable);
                });
            });
    }

});

function activeInactiveEvents(publicationsTable) {

    $("a.btnActive").bind("click", function(e) {
        e.preventDefault();
        var obj = $(this);
        activePublication(obj, publicationsTable);
    });

    $("a.btnInactive").bind("click", function(e) {
        e.preventDefault();
        var obj = $(this);
        inactivePublication(obj, publicationsTable);
    });
}

function activePublication(obj, publicationsTable) {
    var some_html = '<form class="form-horizontal"> <div class="form-group"> ' +
        '<label class="control-label col-lg-4">Title</label> ' +
        '<div class="col-lg-8"> ' +
        '<input type="text" name="pubTitleInput" /> ' +
        '</div> ' +
        '</div>';
    some_html += '<div class="form-group"> ' +
        '<label class="control-label col-lg-4">Subtitle</label> ' +
        '<div class="col-lg-8"> ' +
        '<input type="text" name="pubSubtitleInput" /> ' +
        '</div> ' +
        '</div></form>';

    bootbox.dialog({
        message: some_html,
        title: "Confirmation",
        className: "littleModal",
        buttons: {
            success: {
                label: "Confirm",
                className: "btn-success",
                callback: function() {
                    activeServerRequest(obj, publicationsTable);
                }
            },
            danger: {
                label: "Cancel",
                className: "btn-danger",
                callback: function() {}
            }
        }
    });
}

function inactivePublication(obj, publicationsTable) {
    bootbox.dialog({
        message: "Are you sure you want to inactive this publication?",
        title: "Confirmation",
        className: "littleModal",
        buttons: {
            success: {
                label: "Confirm",
                className: "btn-success",
                callback: function() {
                    inactiveServerRequest(obj, publicationsTable);
                }
            },
            danger: {
                label: "Cancel",
                className: "btn-danger",
                callback: function() {}
            }
        }
    });
}

function activeServerRequest(obj, publicationsTable) {
    var appName = storage.getItem(config.storageAppNameKey);

    var pTitle = $("input[name='pubTitleInput']").val();
    var pSubtitle = $("input[name='pubSubtitleInput']").val();

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
    }, function(err, activated) {

        var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));
        var activeListLength = $.map(activeList, function(n, i) { return i; }).length;

        activeList[activeListLength] = {
            FileName: obj.data("filename") + "/" + obj.data("filename") + "_.pdf",
            Title: pTitle,
            Subtitle: pSubtitle
        };

        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist',
            Body: PlistParser.toPlist(activeList)
        };
        window.awsS3.putObject(params, function(err, data) {
            if (err) {
                alert(Error);
            } else {
                //obj.addClass("btnInactive").addClass("btn-danger").removeClass("btnActive").removeClass("btn-success").html("Inactive").data("id", activeListLength);
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.ttitle')[0]).html(pTitle);
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.tsubtitle')[0]).html(pSubtitle);
                location.reload();
            }
        });

    });
}

function inactiveServerRequest(obj, publicationsTable) {
    var appName = storage.getItem(config.storageAppNameKey);

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
    }, function(err, activated) {

        var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));

        var id = obj.data("id");

        delete activeList[id];

        activeList = deleteFromObject(activeList, undefined);

        //var rowIndex = publicationsTable.fnGetPosition( obj.closest('tr')[0] );
        //publicationsTable.fnDeleteRow(rowIndex);

        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist',
            Body: PlistParser.toPlist(activeList)
        };
        window.awsS3.putObject(params, function(err, data) {
            if (err) {
                alert(Error);
            } else {
                //obj.removeClass("btnInactive").removeClass("btn-danger").addClass("btnActive").addClass("btn-success").html("Active").data("id", 0);
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.ttitle')[0]).html("");
                //publicationsTable.fnGetPosition( obj.parents('tr').closest('.tsubtitle')[0]).html("");
                location.reload();
            }
        });

    });
}

function addRowToTable(data, publicationsTable) {
    publicationsTable.fnAddData( [
        data.FolderName,
        "<span class='ttitle'>" + data.Title + "</span>",
        "<span class='tsubtitle'>" + data.Subtitle + "</span>",
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

function deleteFromObject(obj, deleteValue) {
    var objToArray = $.map(obj, function(value, index) {
        return [value];
    });

    for (var i = 0; i < objToArray.length; ++i) {
        if (objToArray[i] == deleteValue) {
            objToArray.splice(i, 1);
            i--;
        }
    }

    return ArrayToObject(objToArray);
}

function ArrayToObject(arr) {
    var rv = {};
    for (var i = 0; i < arr.length; ++i)
        rv[i] = arr[i];
    return rv;
}

function del(keytr) {
    var appName = storage.getItem(config.storageAppNameKey);

    awsS3.getObject({
        Bucket: window.config.s3Bucket,
        Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist'
    }, function(err, activated) {

        var activeList = PlistParser.parse($.parseXML(activated.Body.toString()));

        delete activeList[keytr];

        activeList = deleteFromObject(activeList, undefined);


        var params = {
            Bucket: window.config.s3Bucket, // required
            Key: window.s3AuthObj.rootDirectory + '/'+appName+'/Magazines.plist',
            Body: PlistParser.toPlist(activeList)
        };
        window.awsS3.putObject(params, function(err, data) {

        });

    });
}
