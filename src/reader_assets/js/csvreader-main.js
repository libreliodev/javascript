initialize_reader(function(app_data, csv_url, csv_url_dir, 
                           external_b, doc_query)
  {
    if(!reader_supported())
      return reader_notify_not_supported(app_data);
    if(!csv_url)
      return;
    var tmpl_url = template_url(app_data, csv_url, csv_url_dir, 
                                external_b, doc_query);
    init_csvreader(csv_url, tmpl_url);
  });
function template_url(app_data, csv_url, csv_url_dir, external_b, doc_query)
{
  /* We don't use watmpl
    if(doc_query.watmpl)
    return reader_url_eval(doc_query.watmpl, external_b, app_data);
  */
  return csvreader_template_url(csv_url, csv_url_dir);
}
