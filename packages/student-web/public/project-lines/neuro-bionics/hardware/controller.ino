// SystemEdu rotary-input gripper STARTER; not a medical device.
// Uno A0: 10k pot wiper; ends 5V/GND. D9: servo signal. D2: stop to GND (INPUT_PULLUP).
// Servo: separate regulated 5V supply with physical switch; grounds common, positives NOT tied to USB 5V.
// Calibrate with horn unloaded first. Physical power switch is the stop, not software alone.
#include <Servo.h>
Servo finger;
const int N=1, CONFIRM=1;
const float CLOSE=0.60, OPEN=0.45;
const int OPEN_ANGLE=90, CLOSE_ANGLE=120; // replace with YOUR measured non-binding endpoints
float history[N]; int used=0,index=0,highCount=0,lowCount=0; bool closed=false; unsigned long last=0;
void setup(){pinMode(2,INPUT_PULLUP);Serial.begin(115200);finger.attach(9);finger.write(OPEN_ANGLE);}
void loop(){
 if(digitalRead(2)==LOW){closed=false;finger.write(OPEN_ANGLE);highCount=lowCount=used=index=0;return;}
 if(millis()-last<200)return;last=millis();
 const int adc=analogRead(A0); history[index]=adc/1023.0;index=(index+1)%N;if(used<N)used++;
 float value=0;for(int i=0;i<used;i++)value+=history[i];value/=used;
 if(value>=CLOSE){highCount++;lowCount=0;}else if(value<=OPEN){lowCount++;highCount=0;}else{highCount=lowCount=0;}
 if(highCount>=CONFIRM)closed=true;if(lowCount>=CONFIRM)closed=false;
 finger.write(closed?CLOSE_ANGLE:OPEN_ANGLE);
 Serial.print(millis());Serial.print(',');Serial.print(adc);Serial.print(',');Serial.print(value,3);Serial.print(',');Serial.println(closed);
}
// ADC has no built-in disconnect flag. A loose pot lead may float: physical stop first.
// Browser null-sample tests do NOT prove this board can detect unplugged wires.
