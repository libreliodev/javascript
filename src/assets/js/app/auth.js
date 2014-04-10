$(function () {
    "use strict";
    
    // define storages
    var ns = $.initNamespaceStorage('auth'),
        local = ns.localStorage,
        session = ns.sessionStorage;
    
    // submitted?
    var submitkeys = ['submit_key','submit_secret','submit_dir'];
    if (session.isSet(submitkeys)) {
        
        // check AWS
        AWS.config.region = 'eu-west-1';
        AWS.config.update({
            accessKeyId: session.get('submit_key'), 
            secretAccessKey: session.get('submit_secret')
        });
        var s3 = new AWS.S3({params: {Bucket: 'librelio-europe'}});
        s3.listObjects(function(error,data) {
             if (error === null) {
                console.log(data);
             } else {
                console.log(error);
             }
          })
        
        // clear submitted data
        //session.remove(submitkeys);
    }
    
    // check authentication
    var storage = (local.get('remember') === true) ? local : session;
    if (!storage.isSet(['key','secret','dir'])) {
        //location.href = 'login.html';
        
    }
    /*
    var key = storage.get('key'),
        secret = storage.get('secret'),
        dir = storage.get('dir');
        
    if ()
    */
    
    //ns.localStorage.set('remember', true);
});

