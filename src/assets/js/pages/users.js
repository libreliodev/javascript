$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    $users_table = $('#usersDataTable');
    console.log(app_name);
    if(!app_name)
        return;
    
    updateUsersTable(app_name, $users_table);

    function updateUsersTable(app_name, $table)
    {
        var dynamodb = new AWS.DynamoDB();
        // test dynamodb
        dynamodb.listTables({ }, function(err, res)
          {
              console.log(err, res);
          });
    }
});
