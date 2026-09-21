// SystemEdu Uno R3 threshold-control starter. Not tested on physical hardware.
// See build-guide.html. USB powers Uno, never the harvesting input or capacitor.
// A0 <- capacitor+ through 10k; A0 -> common ground through 100k (scale 1.1).
// D2 INPUT_PULLUP: a separate validity switch to GND means readings permitted.
// D5 / D6 -> 5V-compatible low-side MOSFET module inputs, USB-powered logic.
// Load positives from H_OUT, load negatives through each MOSFET to common GND.
// Do not connect loads directly to GPIO. Confirm exact module wiring with its maker.
const int CRITICAL=5, OPTIONAL=6, VALID=2;
const float ADC_REFERENCE=5.0; // Measure with a meter; calibrate this value.
const float PAUSE_V=2.35, RESUME_V=2.55;
const bool KEEP_CRITICAL_IF_MISSING=false;
unsigned long previous=0;
bool optionalOn=false;
void setup(){
  digitalWrite(CRITICAL,LOW); digitalWrite(OPTIONAL,LOW);
  pinMode(CRITICAL,OUTPUT); pinMode(OPTIONAL,OUTPUT); pinMode(VALID,INPUT_PULLUP);
  Serial.begin(9600);
  Serial.println("seconds,capacitor_V,valid,critical_on,optional_on");
}
void loop(){
  unsigned long now=millis();
  if((unsigned long)(now-previous)<1000)return;
  previous=now;
  float volts=analogRead(A0)*ADC_REFERENCE/1023.0*1.1;
  bool valid=digitalRead(VALID)==LOW && volts>=2.15 && volts<=2.85;
  bool criticalOn=valid ? volts>2.20 : KEEP_CRITICAL_IF_MISSING;
  if(!valid||volts<=PAUSE_V)optionalOn=false;
  else if(volts>=RESUME_V)optionalOn=true;
  digitalWrite(CRITICAL,criticalOn?HIGH:LOW);
  digitalWrite(OPTIONAL,criticalOn&&optionalOn?HIGH:LOW);
  Serial.print(now/1000);Serial.print(',');Serial.print(volts,3);Serial.print(',');
  Serial.print(valid);Serial.print(',');Serial.print(criticalOn);Serial.print(',');
  Serial.println(criticalOn&&optionalOn);
}
