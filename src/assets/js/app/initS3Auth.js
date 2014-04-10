var s3AuthObj;
if(!supports_html5_storage())
    alert("This app does not support your browser");
else
{
    s3AuthObj = JSON.parse(localStorage.getItem("{{ config.localStorageAuthKey }}"));
    if(!s3AuthObj)
    {
        $('body > *').hide();
        document.location = "login.html";
    }
}
