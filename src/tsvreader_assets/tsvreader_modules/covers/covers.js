var __dirname = TSVReaderModule.dirname;
default_tmpl_url = __dirname + 'covers.tmpl',
tsv_columns_name = [ 'filename', 'title', 'date' ];


TSVReaderModule.ready = function()
{
  var reader = new TSVReader(),
  featured_html;
  reader.get_tsv_element = function() { return TSVReaderModule.element; };
  reader.default_template_url = default_tmpl_url;
  reader.row_content = function(in_row)
  {
    var row = {};
    for(var i = 0; i < tsv_columns_name.length; ++i)
      row[tsv_columns_name[i]] =  in_row[i];
    var fn = paid2free(row.filename||'', true);
    row.img_url = reader.tsv_urldir + '/' + fn + '_newsstand.png';
    row.img_thumbnail_url = reader.tsv_urldir + '/' + fn + '.png';
    return row;
  }
  tsv_url = TSVReaderModule.tsv_url,
  tmpl_url = TSVReaderModule.tmpl_url;
  reader.load(tsv_url, tmpl_url, function(err)
    {
      if(err)
      {
        notifyError(err);
        return;
      }
      var list = document.getElementById('covers-list');
      if(list)
      {
        reader.update_table(list, {
          open_cover_details_dialog: open_cover_details_dialog
        }, 1);
      }

      var featured = document.getElementById('featured-cover');
      if(featured && reader.rows.length > 0)
      {
        featured_html = featured.innerHTML;
        var ctx = {
          index: 0,
          row: reader.rows[0],
          open_cover_details_dialog: open_cover_details_dialog
        };
        $(featured).dhtml('item_init', [ ctx, reader.global_ctx ], 
                          { recursive: true });

      }
    });

  function open_cover_details_dialog(index, row)
  {
    var $cover_details = $('#cover-details');
    if(!$cover_details.data('_original_html'))
      $cover_details.data('_original_html', $cover_details.html());
    else
      $cover_details.html($cover_details.data('_original_html'));

    var ctx = {
      index: 0,
      row: row
    };
    $cover_details.dhtml('item_init', [ ctx, reader.global_ctx ], 
                         { recursive: true });

    $cover_details.modal({ });
    $cover_details.modal('show');
  }

}
function paid2free(fn, noext)
{
  var ext = path.extname(fn),
  bn = path.join(path.dirname(fn), path.basename(fn, ext));
  return (bn.length > 0 && bn[bn.length - 1] == '_' ? 
          bn.substr(0, bn.length - 1) : bn) + (noext ? '' : ext);
}
