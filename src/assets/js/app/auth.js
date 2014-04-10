$(function() {
    "use strict";

    // define storages
    var ns = $.initNamespaceStorage('auth'),
        local = ns.localStorage,
        session = ns.sessionStorage,
        storage = (local.get('remember') === true) ? local : session,
        authkeys = ['key', 'secret', 'dir', 'authvalid'],
        submitkeys = ['submit_key', 'submit_secret', 'submit_dir'];

    // callback for validation
    var checkAuth = function() {
        // check authentication
        if (!storage.isSet(authkeys) && storage.get('authvalid') !== true) {
            location.href = 'login.html';
        }
    }

    // submitted?
    if (session.isSet(submitkeys)) {

        // define parameters
        var bucket = 'librelio-europe',
                key = session.get('submit_key'),
                secret = session.get('submit_secret'),
                dir = session.get('submit_dir');

        // setup AWS
        AWS.config.region = 'eu-west-1';
        AWS.config.update({
            accessKeyId: key,
            secretAccessKey: secret
        });

        // check auth + directory
        var s3 = new AWS.S3({region: AWS.config.region, maxRetries: 1});
        s3.listObjects({Bucket: bucket, Prefix: dir + "/", MaxKeys: 1}, function(error, data) {
            data.Contents = data.Contents || [];
            if (error === null && data.Contents.length > 0) {
                storage.set('key', key);
                storage.set('secret', secret);
                storage.set('dir', dir);
                storage.set('authvalid', true);
            } else {
                alert("Couldn't connect to aws s3: " + err);
            }

            // check the authentication
            checkAuth();
        });

        // clear submitted data
        session.remove(submitkeys);
    }
    else {
        // check the authentication
        checkAuth();
    }

    // logout button
    $('.fa-power-off').click(function() {
        $.removeAllStorages();
        checkAuth();
        return false;
    });
});
