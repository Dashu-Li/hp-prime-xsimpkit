'use strict';
// Explicit domains describe the original input. They are evidence metadata,
// not assumptions silently installed by XSIMP and not a domain-preserving API.
const s = '(sqrt(2+sqrt(5))-i*sqrt(sqrt(5)-2))';
const q = x => 'XSIMP(' + JSON.stringify(x) + ')';
module.exports = [
  {id:'rational_hole',expression:q('(x^2-1)/(x-1)'),expected:'x+1',domain:'x != 1. The legacy answer loses the excluded point; this case does not assert domain retention.',checks:[['legacy_excluded_point','subst(zzbenchresult,x,1)==2']]},
  {id:'trig_identity',expression:q('sin(x)^2+cos(x)^2'),expected:'1',domain:'All finite complex x.'},
  {id:'irrational_power',expression:q('exp((2-sqrt(3))*ln(2))'),expected:'2^(2-sqrt(3))',domain:'Positive real base 2; principal logarithm.'},
  {id:'complex_exponential',expression:q('exp(i*ln(2))'),expected:'exp(i*ln(2))',domain:'Positive real base 2; imaginary exponent.'},
  {id:'complex_root',expression:q('sqrt(4-2*i)'),expected:s,domain:'Principal square root.',proof:'ratnormal'},
  {id:'guarded_complex_denominator',expression:q('sin('+s+')/'+s),expected:'sin('+s+')/'+s,domain:'Closed exact nonzero s, s^2=4-2*i.',proof:'ratnormal'},
  {id:'variable_complex_subtree',expression:q('x*sin('+s+')/'+s),expected:'x*sin('+s+')/'+s,domain:'All finite complex x; exercises currently unguarded variable-containing path.',proof:'ratnormal',complexVariables:1},
  {id:'sqrt_branch',expression:q('sqrt(x^2)'),expected:'sqrt(x^2)',domain:'Principal root; do not replace with x for general complex x.',complexVariables:1,checks:[['negative_real_branch','subst(zzbenchresult,x,-2)==2'],['imaginary_branch','subst(zzbenchresult,x,2*i)==2*i']]},
  {id:'log_branch',expression:q('ln((-1)*(-1))-ln(-1)-ln(-1)'),expected:'-2*i*pi',domain:'Principal logarithm; splitting ln(ab) is not unrestricted.',complexVariables:1},
  {id:'rational_degree8',expression:q('(x^8-1)/(x-1)+(x^6-1)/(x^2-1)'),expected:'x^7+x^6+x^5+2*x^4+x^3+2*x^2+x+2',domain:'x != 1 and x != -1.'},
  {id:'mixed_complexity',expression:q('((sin(x)^2+cos(x)^2)*(y^6-1)/(y^2-1))+(sqrt(8)-2*sqrt(2))+(exp(i)+exp(-i))/2-cos(1)'),expected:'y^4+y^2+1',domain:'y != 1 and y != -1; all finite x.'},
  {id:'rotation_parameter',expression:'XEXPT([[0,-1],[1,0]],t)',expected:'[[cos(t),-sin(t)],[sin(t),cos(t)]]',domain:'All finite t; the t=0 value must remain defined.',checks:[['zero_parameter','zzbenchzero(subst(zzbenchresult,t,0)-[[1,0],[0,1]])']]},
  {id:'nilpotent3',expression:'XEXP([[0,1,0],[0,0,1],[0,0,0]])',expected:'[[1,1,1/2],[0,1,1],[0,0,1]]',domain:'Nilpotent matrix with N^3=0.'},
  {id:'positive_matrix_power',expression:'XPOW(2,[[1,1],[2,3]])',expected:'(2^(2+sqrt(3))+2^(2-sqrt(3)))/2*[[1,0],[0,1]]+(2^(2+sqrt(3))-2^(2-sqrt(3)))/(2*sqrt(3))*[[-1,1],[2,1]]',domain:'Positive scalar base; matrix function, not elementwise power.'},
  {id:'complex_matrix_direct',expression:'XEXPT([[1,-2*i],[1+2*i,1]],i)',expected:'exp(i)*[[cos('+s+'),2*sin('+s+')/'+s+'],[(-2+i)*sin('+s+')/'+s+',cos('+s+')]]',domain:'Exact 2x2 Cayley-Hamilton reference.',proof:'ratnormal'},
  {id:'complex_matrix_quoted',expression:q('exp(i*[[1,-2*i],[1+2*i,1]])'),expected:'exp(i)*[[cos('+s+'),2*sin('+s+')/'+s+'],[(-2+i)*sin('+s+')/'+s+',cos('+s+')]]',domain:'Quoted path prevents native evaluation before XSIMP.',proof:'ratnormal'},
  {id:'nested_list',expression:q('[sin(x)^2+cos(x)^2,(y^2-1)/(y-1),sqrt(8)-2*sqrt(2)]'),expected:'[1,y+1,0]',domain:'y != 1; list traversal.'},
  {id:'approximate_input',expression:'XSIMP(1.25+0.5*i)',expected:'5/4+i/2',approximate:true,domain:'Approximate input must remain approximate; proof is only a numerical tolerance check.',proof:'numeric'}
];
