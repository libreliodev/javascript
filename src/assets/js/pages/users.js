$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    $users_table = $('#usersDataTable'),
    $userInfoDlg = $('#userInfoModal');
    if(!app_name)
        return;
    
    updateUsersTable(app_name, $users_table);
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
                          //user._tr.find('td').eq(0).text(nuser);
                          user._tr.find('td').eq(1).text(npass);
                          
                          alert('User info updated!')
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
                        alert('User has been created successfully!')
                        location.reload();
                    })
             }
             return false;
         });

    function updateUsersTable(app_name, $table)
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
               function statusBtnClick()
               {
                   var $this = $(this);
                   if($this.data('isLoading'))
                       return false;
                       
                   var item = $this.parent().parent().data('userObj');
                   if(!item)
                       return;
                   // start request
                   $this.ladda({}).ladda('start').data('isLoading', true);
                   updateUserInfo(item, {
                       Status: {
                           Action: 'PUT',
                           Value: {N: (!item.Status ? 1 : 0)+''}
                       }
                   }, function(err, res)
                      {
                          $this.ladda('stop').data('isLoading', false);
                          if(err)
                          {
                              handleAWSS3Error(err)
                              return;
                          }
                          var b = (item.Status = !item.Status ? 1 : 0);
                          $this.toggleClass('btn-success', b)
                              .toggleClass('btn-danger', !b)
                              .html(b ? 'Active' : 'Inactive')
                              .removeAttr('data-ladda'); 
                          // ladda's object has remove, remove it's attr for 
                          // remake spinner at next init
                      });
                   return false;
               }
               function userTRClick()
               {
                   var item = $(this).data('userObj');
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
               function createColumnData(key, val)
               {
                   switch(key)
                   {
                   case 'Status':
                       return $('<td/>').append(
                           $('<a class="user-status-btn btn  ' + 
                               (val == 1 ? 'btn-success' : 'btn-danger') +
                               ' btn-xs text-center btnActive"'+
                               ' href="#">'+ 
                               (val == 1 ? 'Active' : 'Inactive') + '</a>')
                             .bind('click', statusBtnClick));
                   default:
                       return $('<td/>').text(val || '')[0];   
                   }
               }
               var items = res.Items,
               $tbody = $table.find('tbody');
               $tbody.empty();

               for(var i = 0, l = items.length; i < l; ++i)
               {
                   var row = items[i], item,
                   tr = $('<tr/>'),
                   tds = [];
                   
                   try {
                       item = {
                           'App': row['App'].S,
                           'User Name': row['User Name'].S,
                           'Password': row['Password'].S,
                           'Status': parseInt(row['Status'].N)
                       };
                   }catch(e) {
                       continue;
                   }

                   tr.data('userObj', item);
                   item._tr = tr;
                   tds.push(createColumnData('User Name', item['User Name']));
                   tds.push(createColumnData('Password', item['Password']));
                   tds.push(createColumnData('Status', item['Status']));
                   
                   tr.bind('click', userTRClick)
                       .append(tds);
                   $tbody.append(tr);
               }
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
