MNG_ID="`ps -ef | awk '/[m]ongod/{print $2}'`"

if [ -z "$MNG_ID" ]; then
  mongod --fork --dbpath /application/mongodb/data --logpath /application/mongodb/log
fi
