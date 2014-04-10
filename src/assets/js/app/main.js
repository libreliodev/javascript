function changeApplication(app)
{
    localStorage.setItem(
        config.localStorageAppNameKey, app);
    leftStatusBarUpdate();
}
