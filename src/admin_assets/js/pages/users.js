$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    $users_table = $('#usersDataTable'),
    users_tableData = $users_table.dataTable(),
    $userInfoDlg = $('#userInfoModal');
    if(!app_name)
        return;
    awsCredentialsReady(function()
      {
        updateUsersTable(app_name, $users_table, users_tableData);
      });

    $userInfoDlg.find('.close').click(function()
         {
             // remove update info
             setTimeout(function()
               {
                   $userInfoDlg.data('userObj', null)
                       .removeClass('update-user-dlg')
                       .toggleClass('new-user-dlg', true);
                   $userInfoDlg.find('input[name=username]').val('')
                       .prop('disabled', false);
                   $userInfoDlg.find('input[name=password]').val('');
                   
               }, 200);
         });
    $userInfoDlg.find('.action-btn').click(function()
         {
             var user = $userInfoDlg.data('userObj'),
             $this = $(this);
             if($this.data('isLoading'))
                 return false;
             $this.ladda({}).ladda('start').data('isLoading', true);
             var nuser = $userInfoDlg.find('input[name=username]').val(),
             npass = $userInfoDlg.find('input[name=password]').val();
             if(user)
             {
                 // update current user
                 updateUserInfo(user, {
                     /* User is part of primary key couldn't change it
                       'User Name': {
                           Action: 'PUT',
                           Value: {S: nuser}
                       },*/
                       'Password': {
                           Action: 'PUT',
                           Value: {S: npass}
                       }
                   }, function(err, res)
                      {
                          $this.ladda('stop').data('isLoading', false);
                          if(err)
                          {
                              handleAWSS3Error(err)
                              return;
                          }
                          user.Password = npass;
                          users_tableData.fnUpdate(npass, user._tr, 1, 
                                                   true, false);
                          
                          alert(_('User info has been updated!'))
                      });
             }
             else
             {
                 // create new user
                 var dynamodb = new AWS.DynamoDB();
                 dynamodb.putItem({
                     TableName: 'Users',
                     Item: {
                         "App": {S: s3AuthObj.rootDirectory + '_' + app_name},
                         "User Name": {S: nuser},
                         "Password": {S: npass},
                         "Status": {N: "0"}
                     }
                 }, function(err, res)
                    {
                        $this.ladda('stop').data('isLoading', false);
                        if(err)
                        {
                            handleAWSS3Error(err)
                            return;
                        }
                        alert(_('User has been created successfully!'))
                        location.reload();
                    })
             }
             return false;
         });

    function updateUsersTable(app_name, $table, tableData)
    {
        var dynamodb = new AWS.DynamoDB();
        // get app's users
        dynamodb.query({
            TableName: 'Users',
            KeyConditions: {
                "App": {
                    ComparisonOperator: 'EQ',
                    AttributeValueList: [
                        /* rootDirectory is publisher name */
                        {'S': s3AuthObj.rootDirectory + '_' + app_name}
                    ]
                }
            }
        }, function(err, res)
           {
               if(err)
               {
                   handleAWSS3Error(err)
                   return;
               }
               function getUserByRowId(id)
               {
                   var pttrn = /row_([0-9]+)/,
                   match = pttrn.exec(id);
                   if(match)
                   {
                       var index = parseInt(match[1])
                       if(index >= 0)
                           return users[index];
                   }
               }
               function statusBtnClick()
               {
                   var $this = $(this);
                   if($this.data('isLoading'))
                       return false;
                   var item = getUserByRowId($this.parent().parent()[0].id);
                   if(!item)
                       return;
                   // start request
                   $this.toggleClass('disabled', true).data('isLoading', true);
                   updateUserInfo(item, {
                       Status: {
                           Action: 'PUT',
                           Value: {N: (!item.Status ? 1 : 0)+''}
                       }
                   }, function(err, res)
                      {
                          $this.removeClass('disabled')
                              .data('isLoading', false);
                          if(err)
                          {
                              handleAWSS3Error(err)
                              return;
                          }
                          var b = (item.Status = !item.Status ? 1 : 0);
                          $this.toggleClass('btn-success', b)
                              .toggleClass('btn-danger', !b)
                              .html(b ? _('Active') : _('Inactive'));
                      });
                   return false;
               }
               function userTRClick()
               {
                   var item = getUserByRowId($(this)[0].id);
                   if(!item)
                       return;
                   $userInfoDlg.data('userObj', item)
                       .removeClass('new-user-dlg')
                       .toggleClass('update-user-dlg', true)
                       .modal('show')
                   $userInfoDlg.find('input[name=username]')
                       .val(item['User Name']).prop('disabled', true);
                   $userInfoDlg.find('input[name=password]')
                       .val(item['Password']);
                   return false;
               }
               function columnData(key, val, class_name)
               {
                   function classStr(b)
                   {
                       return class_name ? (b ? ' class="' : ' ') + 
                           class_name + (b ? '"' : '') : '';
                   }
                   switch(key)
                   {
                   case 'Status':
                       return '<a class="user-status-btn btn' + 
                               classStr(false) + ' ' +
                               (val == 1 ? 'btn-success' : 'btn-danger') +
                               ' btn-xs text-center"'+
                               ' href="#">'+ 
                               (val == 1 ? _('Active') : _('Inactive')) + '</a>';
                   default:
                       return '<span' + classStr(true) + '>' + 
                         $('<td/>').text(val || '').html() +
                         '</span>';
                   }
               }
               var items = res.Items,
               users = [];
               tableData.fnClearTable();
               var columns = [ 'User Name', 'Password', 'Status' ],
               columns_class = $.map(columns, encodeStringToClassName);

               for(var i = 0, l = items.length; i < l; ++i)
               {
                   var row = items[i], item,
                   tds = {
                       'DT_RowId': 'row_' + i
                   };
                   
                   item = {
                       'App': row['App'].S,
                       'User Name': row['User Name'].S,
                       'Password': row['Password'].S,
                       'Status': parseInt(row['Status'].N)
                   };
                   users.push(item);
                   for(var c = 0, cl = columns.length; c < cl; ++c)
                   {
                       var col = columns[c];
                       tds[c+''] = columnData(col, item[col], columns_class[c]);
                   }
                   item._tr = tableData.fnAddData(tds, false)[0];
               }
               $table.on('click', 'tbody > tr', userTRClick)
                   .on('click', '.'+columns_class[2], statusBtnClick);
               tableData.fnDraw();
           });
    }
    function updateUserInfo(user, updateAttrs, cb)
    {
        var dynamodb = new AWS.DynamoDB();
        dynamodb.updateItem({
            TableName: 'Users',
            Key: {
                'App': {S: user['App']},
                'User Name': {S: user['User Name']}
            },
            AttributeUpdates: updateAttrs
        }, cb);
    }
});
