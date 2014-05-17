var Handlebars,
fs = require('fs'),
hbs_ext = '.hbs';
function readHbsHead(file)
{
    var data = fs.readFileSync(file),
    r = {},
    items = (data+'').split(/\n|\r\n/g),
    in_head;
    if(items.length > 0 && items[0] != '---')
        return r;
    for(var i = 0, l = items.length; i < l; ++i)
    {
        var s = items[i];
        if(s == '---')
        {
            if(in_head)
                break;
            in_head = true;
            continue;
        }
        if(in_head)
        {
            var idx = s.indexOf(':');
            if(idx > 0)
                r[s.substr(0, idx).trim()] = s.substr(idx + 1).trim();
            else if(idx != 0)
                r[s.trim()] = true;
        }
    }
    return r;
}
module.exports.register = function (hb, options) {
    Handlebars = hb;
    options = options || {};

    Handlebars.registerHelper('foreach_hbs_in', function(path, opts)
        {
            var files = fs.readdirSync(path),
            r = '';
            if(!files)
                return r;
            // filter files
            var tmp = [];
            for(var i = 0, l = files.length; i < l; ++i)
            {
                var file = files[i];
                if(file.indexOf(hbs_ext) != file.length - hbs_ext.length) // is not hbs
                    continue;
                tmp.push(file);
            }
            files = tmp;
            
            for(var i = 0, l = files.length; i < l; ++i)
            {
                var file = files[i];
                if(file.indexOf(hbs_ext) != file.length - hbs_ext.length) // is not hbs
                    continue;
                var fpath = path + '/' + file,
                data = readHbsHead(fpath);
                data.filename = file;
                r += opts.fn(data);
            }
            return r;
        });
}
