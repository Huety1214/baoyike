(function(E){
  'use strict';
  // Independent teaching contract. These are not any insurer's product rates.
  const TERMS=Object.freeze({entry:.03,annualAccount:.008,annualFund:.006,monthlyAdmin:100,face:1000000,minBalance:10000,freeSwitches:12,switchFee:500,surrender:[.06,.05,.04,.03,.02,0]});
  Object.assign(E.MARKETS.steady,{rate:.02,deposit:.01,gdp:.025,jobless:.04});
  Object.assign(E.MARKETS.growth,{rate:.025,deposit:.015,gdp:.045,jobless:.03});
  Object.assign(E.MARKETS.recession,{rate:.01,deposit:.005,gdp:-.02,jobless:.075});
  Object.assign(E.MARKETS.inflation,{rate:.03,deposit:.02,gdp:.01,jobless:.05});
  E.LABELS.market='事件';E.LABELS.work='機遇';
  const r=Math.round,active=s=>s.investmentPolicy?.status==='active';
  function log(s,title,detail){s.history.push({age:s.age,title,detail,kind:'policy'});}
  function upgrade(s){
    for(const k of ['totalInvestmentPremium','totalPolicyFees','totalSurrenderFees','totalPolicyReturn','investmentDeathBenefit','totalDepositInterest','forcedPolicyCash'])if(!Number.isFinite(s[k]))s[k]=0;
    if(!s.investmentPolicy)s.investmentPolicy=null;
    if(!Number.isFinite(s.priceIndex))s.priceIndex=1;
    if(!Number.isFinite(s.baseLoanInterest))s.baseLoanInterest=s.interest;
    return s;
  }
  const create=E.create;E.create=input=>upgrade(create(input));
  function year(s){return active(s)?Math.floor(Math.max(0,s.age-s.investmentPolicy.startAge))+1:0;}
  function feeRate(s){return active(s)?TERMS.surrender[Math.min(year(s)-1,TERMS.surrender.length-1)]:0;}
  function riskRate(age){return age<35?.0012:age<45?.0025:age<55?.006:age<65?.015:age<75?.035:age<85?.08:.16;}
  function riskCost(s,age=s.age,value=s.investmentPolicy?.value||0){return active(s)?r(Math.max(0,s.investmentPolicy.face-value)*riskRate(age)*(s.health==='chronic'?1.7:1)/12):0;}
  function snapshot(s){
    if(!active(s))return null;
    const p=s.investmentPolicy,charge=feeRate(s),fee=r(p.value*charge);
    return {year:year(s),value:p.value,rate:charge,fee,net:p.value-fee,monthlyRisk:riskCost(s),monthlyAdmin:TERMS.monthlyAdmin,annualPremium:p.annualPremium,deathBenefit:Math.max(p.face,p.value),switches:p.switches};
  }
  function error(s){return s.ended?'人生已結束，不能操作保單。':null;}
  function validateAmount(value,min=1){return Number.isSafeInteger(value)&&value>=min&&value<=1e9;}
  function contribute(s,amount){const p=s.investmentPolicy,fee=r(amount*TERMS.entry);s.cash-=amount;p.value+=amount-fee;p.paid+=amount;p.fees+=fee;s.totalInvestmentPremium+=amount;s.totalPolicyFees+=fee;return fee;}
  function openInvestment(s,{amount,annualPremium=0,stockWeight=.6}={}){
    upgrade(s);if(error(s))return error(s);if(active(s))return '已有生效中的投資型保單。';
    if(!validateAmount(amount,10000)||amount>s.cash)return '首筆保費至少一萬元，且不能超過現金。';
    if(!validateAmount(annualPremium,0)||!Number.isFinite(stockWeight)||stockWeight<0||stockWeight>1)return '請檢查續繳保費及股票比例。';
    s.investmentPolicy={status:'active',value:0,startAge:s.age,annualPremium,stockWeight,face:TERMS.face,paid:0,fees:0,returns:0,withdrawn:0,switches:0,switchYear:1};
    const fee=contribute(s,amount);log(s,'投保投資型壽險',`首筆保費 ${amount}，保費費用 ${fee}，實際投入 ${amount-fee} 元；股票 ${r(stockWeight*100)}%。身故給付為保額與帳戶價值取較大者。`);return null;
  }
  function topUp(s,amount){if(error(s))return error(s);if(!active(s))return '目前沒有生效的投資型保單。';if(!validateAmount(amount,1000)||amount>s.cash)return '追加保費至少一千元，且不能超過現金。';const fee=contribute(s,amount);log(s,'追加投資型保費',`現金 −${amount}，保費費用 ${fee}，帳戶增加 ${amount-fee} 元。`);return null;}
  function quoteWithdrawal(s,amount,all=false){
    if(!active(s))return {error:'目前沒有生效的投資型保單。'};
    const p=s.investmentPolicy,gross=all?p.value:amount;
    if(!validateAmount(gross,1)||gross>p.value)return {error:'提領金額超出帳戶價值，或不是有效整數。'};
    if(!all&&(gross<1000||p.value-gross<TERMS.minBalance))return {error:'部分提領至少一千元，且須保留一萬元帳戶價值；否則請選擇全部解約。'};
    const rate=feeRate(s),fee=r(gross*rate);return {gross,rate,fee,net:gross-fee,remaining:p.value-gross,all};
  }
  function redeem(s,amount,all=false,forced=false){
    if(error(s))return error(s);const q=quoteWithdrawal(s,amount,all);if(q.error)return q.error;
    const p=s.investmentPolicy;p.value-=q.gross;p.withdrawn+=q.net;p.fees+=q.fee;s.cash+=q.net;s.totalPolicyFees+=q.fee;s.totalSurrenderFees+=q.fee;
    if(all){p.status='surrendered';p.annualPremium=0;}
    if(forced)s.forcedPolicyCash+=q.net;
    log(s,forced?'現金不足，強制解約':all?'投資型保單全部解約':'投資型保單部分提領',`帳戶扣除 ${q.gross}，第 ${yearFromPolicy(s,p)} 保單年費率 ${r(q.rate*100)}%，費用 ${q.fee}，現金實收 ${q.net} 元。${all?'保障及後續續繳停止。':''}`);return null;
  }
  function yearFromPolicy(s,p){return Math.floor(Math.max(0,s.age-p.startAge))+1;}
  function configure(s,{annualPremium,stockWeight}){
    if(error(s))return error(s);if(!active(s))return '目前沒有生效的投資型保單。';
    if(!validateAmount(annualPremium,0)||!Number.isFinite(stockWeight)||stockWeight<0||stockWeight>1)return '請輸入有效續繳保費與比例。';
    const p=s.investmentPolicy,y=year(s);if(p.switchYear!==y){p.switchYear=y;p.switches=0;}
    if(stockWeight!==p.stockWeight){const charge=p.switches>=TERMS.freeSwitches?TERMS.switchFee:0;if(p.value-charge<TERMS.minBalance)return '轉換後帳戶不足一萬元，請先追加保費。';p.value-=charge;p.fees+=charge;s.totalPolicyFees+=charge;p.switches++;p.stockWeight=stockWeight;log(s,'調整保單投資配置',`股票 ${r(stockWeight*100)}%，本保單年第 ${p.switches} 次轉換，轉換費 ${charge} 元。`);}
    if(annualPremium!==p.annualPremium){p.annualPremium=annualPremium;log(s,'調整投資型續繳保費',`每年預定續繳 ${annualPremium} 元；每半年嘗試繳入一半。現金不足則跳過，仍會從帳戶扣除保障與管理成本。`);}
    return null;
  }
  function advanceInvestment(s,stockReturn,bondReturn){
    upgrade(s);const market=E.MARKETS[s.market],deposit=r(Math.max(0,s.cash)*market.deposit/2);s.cash+=deposit;s.totalDepositInterest+=deposit;s.priceIndex*=1+market.inflation/2;
    const result={deposit,contribution:0,fees:0,gain:0};if(!active(s))return result;
    const p=s.investmentPolicy,y=year(s);if(p.switchYear!==y){p.switches=0;p.switchYear=y;}
    const half=Math.round((s.age-p.startAge)*2);const scheduled=half%2===0?Math.ceil(p.annualPremium/2):Math.floor(p.annualPremium/2);
    if(scheduled&&s.cash>=scheduled){result.contribution=scheduled;result.fees+=contribute(s,scheduled);}else if(scheduled)log(s,'投資型續繳暫停','可用現金不足，這半年未扣續繳保費；帳戶仍負擔管理費與保障成本。');
    const monthly=Math.pow(1+p.stockWeight*stockReturn+(1-p.stockWeight)*bondReturn,1/6)-1;
    for(let m=0;m<6&&active(s);m++){
      const gain=r(p.value*monthly);p.value+=gain;p.returns+=gain;s.totalPolicyReturn+=gain;result.gain+=gain;
      const fundFee=r(p.value*TERMS.annualFund/12),accountFee=r(p.value*TERMS.annualAccount/12),risk=riskCost(s,s.age+m/12,p.value),due=TERMS.monthlyAdmin+fundFee+accountFee+risk,paid=Math.min(p.value,due);
      p.value-=paid;p.fees+=paid;s.totalPolicyFees+=paid;result.fees+=paid;
      if(p.value===0){p.status='lapsed';p.annualPremium=0;log(s,'投資型保單失效',`帳戶不足支付第 ${m+1} 月管理費、基金費用及保障成本。已扣餘額 ${paid} 元，保障停止；本教學模型不模擬催告寬限期。`);}
    }
    log(s,'投資型保單半年結算',`繳入 ${result.contribution}、投資損益 ${result.gain}、各項費用 ${result.fees}、期末帳戶 ${p.value} 元。費用包含保費費用、管理費、基金費與年齡相關保障成本。`);
    return result;
  }
  function settleInvestmentDeath(s){if(!active(s))return 0;const p=s.investmentPolicy,payout=Math.max(p.face,p.value);p.status='paid';p.value=0;p.annualPremium=0;s.investmentDeathBenefit=payout;log(s,'投資型身故給付',`保額與帳戶價值取較大者，給付 ${payout} 元；帳戶已轉為家屬給付，不再重複計入資產。`);return payout;}
  function setMarket(s,key){s.market=key;s.interest=Math.max(0,Math.min(30,s.baseLoanInterest+(E.MARKETS[key].rate-E.MARKETS.steady.rate)*100));}
  Object.assign(E,{INVESTMENT_TERMS:TERMS,upgrade,investmentActive:active,investmentYear:year,investmentSnapshot:snapshot,investmentRiskCost:riskCost,openInvestment,topUpInvestment:topUp,quoteInvestment:quoteWithdrawal,redeemInvestment:redeem,configureInvestment:configure,advanceInvestment,settleInvestmentDeath,setMarket});
})(LifeEngine);
