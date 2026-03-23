$env:MYSQL_HOST='localhost'
$env:MYSQL_USER='Wanzala'
$env:MYSQL_PASSWORD='Wanzala@8728!'
$env:MYSQL_DATABASE='network_tracker'
$env:TOKEN_SECRET='dev_secret'

Set-Location 'C:\Users\wanza\network tracking\backend'
node .\server.js
