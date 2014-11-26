$(function(){
    var app_name = storage.getItem(config.storageAppNameKey),
    $table = $('#dataTable'),
    tableData = $table.dataTable(),
    $infoDlg = $('#triggerInfoModal'),
    dynamodb, simpledb,
    actionsPlist, triggersPlist;
    if(!app_name)
        return;

    // init trigger's custom params
    $('#trigger-custom-params').dhtml('list_init');

    awsCredentialsReady(function()
      {
          dynamodb = new AWS.DynamoDB();

          async.parallel([
              function(cb)
              {
                  ajaxLoadPlistFile('http://librelio-europe.s3.amazonaws.com/AAS_/Actions.plist',
                                    function(err, data)
                      {
                          if(err)
                              return cb(err);
                          actionsPlist = data;
                          // update info dialog select action
                          var $sel = $('#select-action');
                          $sel.children().remove();
                          data = data.concat();
                          data.unshift({ Name: _("<Select action>"), fake: true});
                          for(var i = 0; i < data.length; ++i)
                          {
                              var action  = data[i],
                              $el = $('<option/>');
                              $el.text(action.Name);
                              if(action.fake)
                                  $el.attr('value', '');
                              else
                                  $el.attr('value', action.Name);
                              $sel.append($el);
                          }
                          cb()
                      });
              },
              function(cb)
              {
                  ajaxLoadPlistFile('http://librelio-europe.s3.amazonaws.com/AAS_/Triggers.plist',
                                    function(err, data)
                    {
                        if(err)
                            return cb(err);
                        triggersPlist = data;
                        // update info dialog select action
                        var $sel = $('#select-trigger');
                        $sel.children().remove();
                        data = data.concat();
                        data.unshift({ Name: _("<Select trigger>"), fake: true});
                        for(var i = 0; i < data.length; ++i)
                        {
                            var trigger  = data[i],
                            $el = $('<option/>');
                            $el.text(trigger.Name);
                            if(trigger.fake)
                                $el.attr('value', '');
                            else
                                $el.attr('value', trigger.Name);
                            $sel.append($el);
                        }
                        cb();
                    });
              }
          ], function(err)
             {
                 triggerDialogUpdateParams();
                 
                 updateTriggersTable(app_name, $table, tableData);
             });
      });

    $infoDlg.on('hidden.bs.modal', function()
         {
             // remove update info
             setTimeout(function()
               {
                   $infoDlg.data('rowObj', null)
                       .removeClass('update-dlg')
                       .toggleClass('new-dlg', true);
                   // clear infoDlg inputs
                   
                   
               }, 200);
         });
    $infoDlg.on('show.bs.modal', function(ev)
         {
             if(ev.target != this)
                 return;
             var rowObj = $infoDlg.data('rowObj');
             if(!rowObj)
             {
                 $infoDlg.find('.action-btn').prop('disabled', false);
                 $('#select-trigger').val('').prop('disabled', false);
                 $('#select-action').val('');
             }
             else
             {
                 $('#select-trigger').val(rowObj['Trigger Name'])
                   .prop('disabled', true);
                 $('#select-action').val(rowObj['Action Name']);
             }
             triggerDialogUpdateParams();
         });
    $infoDlg.find('.action-btn').click(function()
         {
             function make_params(prefix, params_def, values)
             {
                 var params_def = prefix_params_name(prefix, params_def||[]),
                 params = {};
                 for(var i = 0; i < params_def.length; ++i)
                 {
                     var def = params_def[i];
                     if(typeof values[def.Key] != 'undefined')
                     {
                         var key = def.Name,
                         value = values[def.Key];
                         switch(def.Type)
                         {
                         case 'Number':
                             if(isNaN(parseFloat(value)))
                                 value = '0';
                             params[key] = {N: value};
                             break;
                         default:
                             params[key] = {S: value};
                             break;
                         }
                     }
                 }
                 return params;
             }
             var rowObj = $infoDlg.data('rowObj'),
             $this = $(this),
             values = triggerParamsGetValues(),
             trigger_name = $('#select-trigger').val(),
             action_name = $('#select-action').val()
             trigger = trigger_name ? findByName(triggersPlist, trigger_name) : null,
             action = action_name ? findByName(actionsPlist, action_name) : null;
             if($this.data('isLoading') || !trigger || !action)
                 return false;
             $this.ladda({}).ladda('start').data('isLoading', true);
             if(rowObj)
             {
                 // update current user
                 updateTriggerInfo(rowObj, {
                     "Action Name": {
                       Action: 'PUT',
                       Value: {S: action_name}
                     }, 
                     "Action Parameters": {
                       Action: 'PUT',
                       Value: {M: make_params('action_', action.Parameters, values)}
                     },
                     "Trigger Parameters": {
                       Action: 'PUT',
                       Value: {M: make_params('trigger_', trigger.Parameters, values)}
                     }
                 }, function(err, res)
                    {
                        $this.ladda('stop').data('isLoading', false);
                        if(err)
                        {
                            handleAWSS3Error(err)
                            return;
                        }
                        alert(_('Trigger info has been updated!'))
                        location.reload();
                    });
             }
             else
             {
                 // create new user
                 dynamodb.putItem({
                     TableName: 'Triggers',
                     Item: {
                         "App": {S: s3AuthObj.rootDirectory + '_' + app_name},
                         "Action Name": {S: action_name},
                         "Trigger Name": {S: trigger_name + '_' + 
                                      Math.floor(new Date().getTime()  / 1000)},
                         "Action Parameters": {M: make_params('action_', action.Parameters, values)},
                         "Trigger Parameters": {M: make_params('trigger_', trigger.Parameters, values)},
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
                        alert(_('Trigger has been created successfully!'))
                        location.reload();
                    })
             }
             return false;
         });
    $('#select-trigger,#select-action').change(triggerDialogUpdateParams);
    function prefix_param_values_key(prefix, values)
    {
        var ret = {};
        for(var name in values)
        {
            ret[prefix + name] = values[name];
        }
        return ret;
    }
    function prefix_params_name(prefix, params)
    {
        var ret = [];
        for(var i = 0; i < params.length; ++i)
        {
            rparam = $.extend(false, {}, params[i]);
            rparam.Name = rparam.Name;
            rparam.Key = prefix + rparam.Name;
            ret.push(rparam);
        }
        return ret;
    }
    function triggerDialogUpdateParams()
    {
        var rowObj = $infoDlg.data('rowObj'),
        trigger_name = $('#select-trigger').val(),
        trigger = trigger_name ? findByName(triggersPlist, trigger_name) : null,
        action_name = $('#select-action').val(),
        action = action_name ? findByName(actionsPlist, action_name) : null,
        ctrs_params = [trigger ? prefix_params_name('trigger_', trigger.Parameters || []) : [],
                  action ? prefix_params_name('action_', action.Parameters || []) : []],
        values = rowObj ? rowObj.Parameters : {};
        if(trigger)
        {
            var $trigger_params = $('#trigger-custom-params');
            $ctrs_params = [$trigger_params, $('#action-custom-params')],
            form_values = triggerParamsGetValues();
            for(var c = 0; c < $ctrs_params.length; ++c)
            {
                var $ctr_params = $ctrs_params[c],
                params = ctrs_params[c];
                $ctr_params.children().remove();
                for(var i = 0; i < params.length; ++i)
                {
                    var param = params[i],
                    type = param.Type || 'Text',
                    $el = $trigger_params.dhtml('list_new_item', type),
                    ctx = { Value: typeof values[param.Key] != 'undefined' ? values[param.Key]+'' : undefined },
                    ctx2 = { Value: typeof form_values[param.Key] != 'undefined' ? form_values[param.Key]+'' : undefined };
                    if($el)
                    {
                        $el.dhtml('item_init', [ ctx2, ctx, param ], { recursive: true });
                        $ctr_params.append($el);
                        if(type == 'Date')
                            $el.find('.input-group.date').datepicker({
                                format: 'dd-mm-yyyy'
                            });
                        else if(type == 'Time')
                            $el.find('.timepicker').timepicker({ });
                    }
                }
            }
            $infoDlg.find('.action-btn').prop('disabled', !(trigger && action));
        }
        else
        {
            $('#trigger-custom-params,#action-custom-params').html('');
            $infoDlg.find('.action-btn').prop('disabled', true);
        }
    }
    function triggerParamsGetValues()
    {
        var ret = {};
        $('#trigger-custom-params,#action-custom-params').find('input')
            .each(function()
            {
                ret[this.name] = this.value;
            });
        return ret;
    }
    function findByName(arr, name)
    {
        if(!arr)
            return null;
        for(var i = 0; i < arr.length; ++i)
            if(arr[i].Name == name)
                return arr[i];
        return null;
    }
    function updateTriggersTable(app_name, $table, tableData)
    {
        var dynamodb = new AWS.DynamoDB();
        // get app's users
        dynamodb.query({
            TableName: 'Triggers',
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
                   if(err.code == 'AccessDeniedException')
                       notifyUserError(_("Your subscription does not include triggers. Please contact Librelio for more details"));
                   else
                       handleAWSS3Error(err)
                   return;
               }
               function getItemByRowId(id)
               {
                   var pttrn = /row_([0-9]+)/,
                   match = pttrn.exec(id);
                   if(match)
                   {
                       var index = parseInt(match[1])
                       if(index >= 0)
                           return items[index];
                   }
               }
               function statusBtnClick()
               {
                   var $this = $(this);
                   if($this.data('isLoading'))
                       return false;
                   var item = getItemByRowId($this.parent().parent()[0].id);
                   if(!item)
                       return;
                   // start request
                   $this.toggleClass('disabled', true).data('isLoading', true);
                   updateTriggerInfo(item, {
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
               function rowTRClick()
               {
                   var item = getItemByRowId($(this)[0].id);
                   if(!item)
                       return;
                   $infoDlg.data('rowObj', item)
                       .removeClass('new-dlg')
                       .toggleClass('update-dlg', true)
                       .modal('show');
                   // set input values
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
                       return '<a class="status-btn btn' + 
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
               var tableItems = res.Items,
               items = [];
               tableData.fnClearTable();

               var columns = [ 
                   'Trigger Name', 'Trigger Value', 
                   'Action Name', 'Action Value',
                   'Status'
               ],
               columns_class = $.map(columns, encodeStringToClassName);

               for(var i = 0, l = tableItems.length; i < l; ++i)
               {
                   var row = tableItems[i], item,
                   tds = {
                       'DT_RowId': 'row_' + i
                   },
                   Id = row['Trigger Name'] ? row['Trigger Name'].S : '',
                   trigger_name = Id.indexOf('_') != -1 ? Id.split('_').slice(0, -1) : Id,
                   action_name = row['Action Name'] ? row['Action Name'].S : '',
                   trigger = findByName(triggersPlist, trigger_name),
                   action = findByName(actionsPlist, action_name),
                   trigger_params = read_dynamodb_map(row['Trigger Parameters'] ? row['Trigger Parameters'].M : {}),
                   action_params = read_dynamodb_map(row['Trigger Parameters'] ? row['Action Parameters'].M : {});
                   
                   item = {
                       'App': row['App'].S,
                       'Id': Id,
                       'Trigger Name': trigger_name,
                       'Action Name': action_name,
                       'Trigger Value': trigger && trigger.Parameters && trigger.Parameters[0] ? trigger_params[trigger.Parameters[0].Name] : '',
                       'Action Value': action && action.Parameters && action.Parameters[0] ? action_params[action.Parameters[0].Name] : '',
                       'Parameters': 
                         $.extend(false, {}, prefix_param_values_key('trigger_', trigger_params),
                                  prefix_param_values_key('action_', action_params)),
                       'Status': parseInt(row['Status'] ? row['Status'].N : 0)
                   };
                   items.push(item);
                   for(var c = 0, cl = columns.length; c < cl; ++c)
                   {
                       var col = columns[c];
                       tds[c+''] = columnData(col, item[col], columns_class[c]);
                   }
                   item._tr = tableData.fnAddData(tds, false)[0];
               }
               $table.on('click', 'tbody > tr', rowTRClick)
                   .on('click', '.'+columns_class[4], statusBtnClick);
               tableData.fnDraw();
           });
    }
    function updateTriggerInfo(trigger, updateAttrs, cb)
    {
      dynamodb.updateItem({
        TableName: 'Triggers',
        Key: {
          'App': {S: trigger['App']},
          'Trigger Name': {S: trigger['Id']}
        },
        AttributeUpdates: updateAttrs
      }, cb);
    }
});
function ajaxLoadPlistFile(url_str, cb)
{
    $.ajax(url_str, {
        success: function(data)
        {
            var obj,
            err;
            try {
                obj = $.plist($.parseXML(data));
            } catch(err) {
                err = sprintf(_("Couldn't parse `%s`: %s"), url_str, err);
            }
            cb(err, obj);
        },
        error: function(xhr, err, err_text)
        {
            cb(sprintf(_("Couldn't load `%s`: %s"), url_str, err_text));
        }
    });
}
function read_dynamodb_map(map)
{
    var ret = {};
    for(var key in map)
    {
        var value = map[key];
        for(var i in value)
        {
            switch(i)
            {
            case 'N':
                value = parseFloat(value[i]);
                break;
            case 'S':
                value = value[i];
                break;
            }
        }
        ret[key] = value;
    }
    return ret;
}
