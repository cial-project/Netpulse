@echo off 
 set cmdline="D:\netpulse\usr\bin\snmptrapd.exe" -register 
set additionaloptions= -Lf "D:/netpulse/usr/log/snmptrapd.log"
echo Registering snmptrapd as a service using the following additional options: 
 echo . 
 echo %additionaloptions% 
 
echo . 
 %cmdline% %additionaloptions% 
 echo .  
 echo For information on running snmpd.exe and snmptrapd.exe as a Windows 
 echo service, see 'How to Register the Net-SNMP Agent and Trap Daemon as 
 echo Windows services' in README.win32. 
 echo . 
 pause