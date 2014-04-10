$(function(){
    $('#logout-anchor').click(function()
       {
           if(supports_html5_storage())
               localStorage.setItem("{{ config.localStorageAuthKey }}", null);
       });
    
    // app-list dropdown impl
    // loading sign
    var load_img = new Image();
    load_img.src = "{{ assets }}/img/loading-light.gif";

    var dd_toggle = $('#app-list-dropdown-toggle');
    $(load_img).css('lineHeight', dd_toggle.height());
    
    //dd_toggle.prepend(load_img);
    /* load app's list and remove loading sign */
    if(s3AuthObj)
    {

    }
});
