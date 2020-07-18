const { IMPROVEMENTS, ACTIONS, SOWABLE, MAJOR_IMPROVEMENTS, MINOR_IMPROVEMENTS, RESOURCES, RESOURCE_ACTIONS } = require('./constants');
const { EVALUATION_IMPROVEMENTS, EVALUATION_OCCUPATIONS } = require('./evaluationReference');
const AIBase = require('./aiBase');

const AI = class extends AIBase {
  /**
   * 柵を立てる
   *
   * @param 今の柵の状態
   *  x:上からのブロックのindex
   *  y:左からのブロックのindex
   *  z:ブロックの上辺:0右辺:1(y=4のブロックにのみ存在)下辺:2(x=2のブロックにのみ存在)左辺:3
   *
   * @returns 完成形の柵
   */
  fences(fenceList) {
    return [
      {
        x: 1,
        y: 2,
        z: 0
      },
      {
        x: 1,
        y: 2,
        z: 3
      },
      {
        x: 1,
        y: 3,
        z: 0
      },
      {
        x: 1,
        y: 3,
        z: 3
      },
      {
        x: 1,
        y: 4,
        z: 0
      },
      {
        x: 1,
        y: 4,
        z: 1
      },
      {
        x: 1,
        y: 4,
        z: 3
      },
      {
        x: 2,
        y: 2,
        z: 3
      },
      {
        x: 2,
        y: 2,
        z: 2
      },
      {
        x: 2,
        y: 3,
        z: 0
      },
      {
        x: 2,
        y: 3,
        z: 3
      },
      {
        x: 2,
        y: 3,
        z: 2
      },
      {
        x: 2,
        y: 4,
        z: 3
      },
      {
        x: 2,
        y: 4,
        z: 1
      },
      {
        x: 2,
        y: 4,
        z: 2
      }
    ];
  }
  /**
   * 種をまく
   */
  sow(sems) {
    const rSow = {};
    const myInfo = this.myInfo();
    let grainRest = myInfo.grain;
    let vegetableRest = myInfo.vegetable;
    let vegetableSum = myInfo.vegetable + myInfo.fieldDetail.vegetable.reduce((s, v) => s + v, 0);
    Object.keys(sems).forEach(k => {
      if (vegetableSum < 4 && vegetableRest > 0) {
        rSow[k] = SOWABLE.VEGETABLE;
        vegetableRest--;
        vegetableSum++;
        return
      }
      if (grainRest > 0) {
        rSow[k] = SOWABLE.GRAIN;
        grainRest--;
        return
      }
      if (vegetableRest > 0) {
        rSow[k] = SOWABLE.VEGETABLE;
        vegetableRest--;
        vegetableSum++;
        return
      }
    });
    return rSow;
  }
  /**
   * パンを焼く
   */
  // TODO 実装
  // とりあえずデフォのものを用いる
  /*
  cuire(cuires) {
    const rCuire = Object.keys(cuires).map(() => 0);
    rCuire[0] = 1;
    return rCuire;
  }
  */
  /**
   * 動物を牧場に入れる。
   * 牛>猪>羊で入るだけ入れる（入れ方は全く考えない）。
   */
  valider(mRef, sRef, bfRef, capacity) {
    let bf = bfRef;
    let s = sRef;
    let m = mRef;
    const ret = {
      se: {},
      am: {}
    };
    Object.keys(capacity.se).forEach(n => {
      ret.se[n] = {
        m: 0,
        s: 0,
        bf: 0
      };
      if (bf > 0) {
        const bfIn = Math.min(bf, capacity.se[n].bf);
        ret.se[n].bf = bfIn;
        bf -= bfIn;
        return;
      }
      if (s > 0) {
        const sIn = Math.min(s, capacity.se[n].s);
        ret.se[n].s = sIn;
        s -= sIn;
        return;
      }
      if (m > 0) {
        const mIn = Math.min(m, capacity.se[n].m);
        ret.se[n].m = mIn;
        m -= mIn;
        return;
      }
    });
    Object.keys(capacity.am).reverse().forEach(n => {
      ret.am[n] = {
        m: 0,
        s: 0,
        bf: 0
      };
      if (bf > 0) {
        const bfIn = Math.min(bf, capacity.am[n].bf);
        ret.am[n].bf = bfIn;
        bf -= bfIn;
      }
      if (s > 0) {
        const sIn = Math.min(s, capacity.am[n].s);
        ret.am[n].s = sIn;
        s -= sIn;
      }
      if (m > 0) {
        const mIn = Math.min(m, capacity.am[n].m);
        ret.am[n].m = mIn;
        m -= mIn;
      }
    });
    
    return ret;
  }
  /**
   * ドラフト
   */
  createDraftPrior(amPicked, sfPicked) {
    return {
      am: Object.keys(EVALUATION_IMPROVEMENTS).sort((a, b) => EVALUATION_IMPROVEMENTS[b] - EVALUATION_IMPROVEMENTS[a]),
      sf: Object.keys(EVALUATION_OCCUPATIONS).sort((a, b) => EVALUATION_OCCUPATIONS[b] - EVALUATION_OCCUPATIONS[a])
    };
  }
  /**
   * アクション
   */
  createActionPrior() {
    const prior = [];
    const myInfo = this.myInfo();
    const evalFoodAction = a => {
      let foodMul = 1;
      // TODO 職業と進歩の評価
      switch (a) {
        case ACTIONS.DAY_LABOURER:
          return 2;
        case ACTIONS.FISHING:
          break;
        case ACTIONS.SHEEP1:
          foodMul = [IMPROVEMENTS.FIREPLACE2, IMPROVEMENTS.FIREPLACE3, IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 2 :
                    [IMPROVEMENTS.SIMPLE_FIREPLACE].some(ch => myInfo.cards.includes(ch)) ? 1 : 0;
          break;
        case ACTIONS.BOAR1:
          foodMul = [IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 3 : 2;
          break;
        case ACTIONS.CATTLE1:
          foodMul = [IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5].some(ch => myInfo.cards.includes(ch)) ? 4 : 3;
          break;
        default:
          break;
      }
      return this.info.resource[a] * foodMul;
    };
    const pushFoodPrior = () => {
      const foods = [];
      if (this.canCookAnimal()) {
        foods.push(ACTIONS.SHEEP1);
        foods.push(ACTIONS.BOAR1);
        foods.push(ACTIONS.CATTLE1);
      }
      foods.push(ACTIONS.DAY_LABOURER);
      foods.push(ACTIONS.FISHING);
      foods.sort((a, b) => evalFoodAction(b) - evalFoodAction(a));
      foods.forEach(f => {
        prior.push(f);
      });
    };
    const pushResourcePrior = (resourceActions) => {
      resourceActions.sort((a, b) => this.info.resource[b] - this.info.resource[a]);
      resourceActions.forEach(f => {
        prior.push(f);
      });
    }
    
    // 食料が足りなければまず食料確保
    if (myInfo.family * 2 > myInfo.food) {
      pushFoodPrior();
    }
    // ただなら職業を出す
    if (myInfo.sf.length == 0) {
      prior.push(ACTIONS.OCCUPATION1_1);
    }
    
    // 家族3人をまず目指す
    if (myInfo.family < 3) {
      // 家を増築済みか
      if (myInfo.rooms > myInfo.family) {
        // 家族を増やしたのちの食料が足りるか
        if ((myInfo.family + 1) * 2 > myInfo.food) {
          pushFoodPrior();
        }
        prior.push(ACTIONS.FAMILY_MINOR_IMPROVEMENT);
      } else {
        // 家が増築していない場合は増築を目指す
        if (myInfo.wood < 5) {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.WOOD]);
        }
        if (myInfo.reed < 2) {
          prior.push(ACTIONS.REED1);
        }
        if (myInfo.wood >= 5 && myInfo.reed >= 2) {
          prior.push(ACTIONS.HOUSE_STABLE);
        }
      }
    }
    // かまど2をとれるなら取る
    if (!this.canCookAnimal()) {
      if (Object.keys(this.info.player).every(i => !this.info.player[i].cards.includes(IMPROVEMENTS.FIREPLACE2))) {
        if (myInfo.clay >= 2) {
          prior.push(ACTIONS.IMPROVEMENT);
        } else {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.CLAY]);
        }
      }
    }
    
    // 畑
    const fieldPrior = [];
    // 2か所種をまけるならまく
    const vegetableSum = myInfo.vegetable + myInfo.fieldDetail.vegetable.reduce((s, v) => s + v, 0);
    const grainSum = myInfo.grain + myInfo.fieldDetail.grain.reduce((s, v) => s + v, 0);
    if ((myInfo.grain + myInfo.vegetable >= 2) && myInfo.fieldDetail.blank >= 2) {
      fieldPrior.push(ACTIONS.SOW_BAKING_BREAD);
    }
    // 隙あれば畑を耕す
    if (myInfo.fields < 5) {
      fieldPrior.push(ACTIONS.PLOUGHING_SOW);
      fieldPrior.push(ACTIONS.PLOUGHING);
    }
    // 隙あれば野菜をとる
    if (vegetableSum === 0 || myInfo.vegetable + myInfo.grain < myInfo.fieldDetail.blank) {
      fieldPrior.push(ACTIONS.VEGETABLE);
    }
    // 隙あれば小麦をとる
    if (grainSum === 0 || myInfo.vegetable + myInfo.grain < myInfo.fieldDetail.blank) {
      fieldPrior.push(ACTIONS.GRAIN);
    }
    const priorMap = myInfo.fieldDetail.blank >= 2 ? {
      [ACTIONS.SOW_BAKING_BREAD]: 1,
      [ACTIONS.PLOUGHING_SOW]: 4,
      [ACTIONS.PLOUGHING]: 5,
      [ACTIONS.VEGETABLE]: 2,
      [ACTIONS.GRAIN]: 3
    } : {
      [ACTIONS.SOW_BAKING_BREAD]: 5,
      [ACTIONS.PLOUGHING_SOW]: 1,
      [ACTIONS.PLOUGHING]: 2,
      [ACTIONS.VEGETABLE]: 3,
      [ACTIONS.GRAIN]: 4
    };
    fieldPrior.sort((a, b) => priorMap[a] - priorMap[b]);
    fieldPrior.forEach(fp => {
      prior.push(fp);
    });
    
    // 次にレンガの家を目指す
    if (myInfo.roomLevel === 1) {
      if (myInfo.clay < myInfo.rooms) {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.CLAY]);
      }
      if (myInfo.reed < 1) {
        prior.push(ACTIONS.REED1);
      }
      if (myInfo.clay >= myInfo.rooms && myInfo.reed >= 1) {
        prior.push(ACTIONS.RENOVATION_IMPROVEMENT);
      }
    }
    // レンガの家になったら家族4人を目指す
    if (myInfo.roomLevel === 2 && myInfo.family < 4) {
      // 家を増築済みか
      if (myInfo.rooms > myInfo.family) {
        // 家族を増やしたのちの食料が足りるか
        if ((myInfo.family + 1) * 2 > myInfo.food) {
          pushFoodPrior();
        }
        prior.push(ACTIONS.FAMILY_MINOR_IMPROVEMENT);
      } else {
        // 家が増築していない場合は増築を目指す
        if (myInfo.clay < 5) {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.CLAY]);
        }
        if (myInfo.reed < 2) {
          prior.push(ACTIONS.REED1);
        }
        if (myInfo.clay >= 5 && myInfo.reed >= 2) {
          prior.push(ACTIONS.HOUSE_STABLE);
        }
      }
    }
    // 柵を立てる
    if (myInfo.fence === 15) {
      if (myInfo.wood >= 15) {
        prior.push(ACTIONS.FENCES);
      } else {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.WOOD]);
      }
    } else {
      // 柵が建っていたら中身を入れる
      if (myInfo.cattle < 6) {
        prior.push(ACTIONS.CATTLE1);
      }
      if (myInfo.boar < 7) {
        prior.push(ACTIONS.BOAR1);
      }
      if (myInfo.sheep < 8) {
        prior.push(ACTIONS.SHEEP1);
      }
    }
    // 最後に石の家を目指す
    if (myInfo.roomLevel === 2 && myInfo.family >= 4) {
      if (myInfo.stone < myInfo.rooms) {
          pushResourcePrior(RESOURCE_ACTIONS[RESOURCES.STONE]);
      }
      if (myInfo.reed < 1) {
        prior.push(ACTIONS.REED1);
      }
      if (myInfo.stone >= myInfo.rooms && myInfo.reed >= 1) {
        prior.push(ACTIONS.RENOVATION_IMPROVEMENT);
      }
    }
    
    // ラス手番ならスタプを取りに行く TODO 小進歩材をとってから
    if ((this.info.first + 1) % Object.keys(this.info.player).length === this.info.iam) {
      prior.push(ACTIONS.START_PLAYER_MINOR_IMPROVEMENT);
    }
    
    this.logger({
      prior: prior.map(a => {
        switch(a) {
          case ACTIONS.WOOD3:
            return '木3';
          case ACTIONS.CLAY1_1:
            return 'レンガ1';
          case ACTIONS.REED1:
            return '葦1';
          case ACTIONS.FISHING:
            return '漁';
          case ACTIONS.HOUSE_STABLE:
            return '増築・厩';
          case ACTIONS.START_PLAYER_AND_FOOD:
            return 'スタートプレーヤー・食料';
          case ACTIONS.GRAIN:
            return '小麦1';
          case ACTIONS.PLOUGHING:
            return '畑を耕す';
          case ACTIONS.STABLE_BREAD:
            return '厩・パンを焼く';
          case ACTIONS.DAY_LABOURER_RESOURCE:
            return '日雇い・資源';
          case ACTIONS.START_PLAYER_MINOR_IMPROVEMENT:
            return 'スタートプレーヤー・小進歩';
          case ACTIONS.OCCUPATION1_1:
            return '職業';
          case ACTIONS.DAY_LABOURER:
            return '日雇い';
          case ACTIONS.WOOD2_1:
            return '木2';
          case ACTIONS.CLAY1_2:
            return 'レンガ1';
          case ACTIONS.RESOURCE1:
            return '資源1';
          case ACTIONS.RESOURCE2:
            return '資源2';
          case ACTIONS.OCCUPATION1_2:
            return '職業';
          case ACTIONS.REED_WOOD_STONE:
            return '木石葦';
          case ACTIONS.WOOD1:
            return '木1';
          case ACTIONS.CRAY2:
            return 'レンガ2';
          case ACTIONS.TRAVELLING_PLAYERS:
            return '小劇場';
          case ACTIONS.OCCUPATION1_3:
            return '職業';
          case ACTIONS.SUPPLY:
            return '供給';
          case ACTIONS.WOOD4:
            return '木4';
          case ACTIONS.CRAY3:
            return 'レンガ3';
          case ACTIONS.OCCUPATION_OR_FAMILY:
            return '職業もしくは家族';
          case ACTIONS.HOUSE1_OR_TRAVELLING_PLAYERS:
            return '増築1もしくは小劇場';
          case ACTIONS.ANIMAL:
            return '家畜';
          case ACTIONS.SHEEP1:
            return '羊1';
          case ACTIONS.IMPROVEMENT:
            return '進歩';
          case ACTIONS.FENCES:
            return '柵';
          case ACTIONS.SOW_BAKING_BREAD:
            return '種を植える・パンを焼く';
          case ACTIONS.RENOVATION_IMPROVEMENT:
            return '改築・進歩';
          case ACTIONS.FAMILY_MINOR_IMPROVEMENT:
            return '家族を増やす・小進歩';
          case ACTIONS.STONE1_1:
            return '石1';
          case ACTIONS.BOAR1:
            return '猪1';
          case ACTIONS.VEGETABLE:
            return '野菜1';
          case ACTIONS.CATTLE1:
            return '牛1';
          case ACTIONS.STONE1_2:
            return '石1';
          case ACTIONS.PLOUGHING_SOW:
            return '畑を耕す・種を植える';
          case ACTIONS.FAMILY_WITHOUT_ROOM:
            return '家がなくても家族を増やす';
          case ACTIONS.RENOVATION_FENCES:
            return '改築・柵';
          case ACTIONS.WOOD2_2:
            return '木2';
          default:
            break;
        }
        return 'undefined';
      })
    });
    
    return prior;
  }
  // アクションの追加選択肢
  /**
   * 増築・厩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createHouseStablePrior() {
    return ['5a,5b', '5b,5a', '5a', '5b'];
  }
  */
  /**
   * 種をまくそして/またはパンを焼く
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createSowBakePrior() {
    return ['34a,34b', '34b,34a', '34a', '34b'];
  }
  */
  /**
   * 改築・進歩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createRenovationImprovementPrior() {
    return ['35a,35b', '35a'];
  }
  */
  /**
   * 家族を増やす・小進歩
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createFamilyMinorImprovementPrior() {
    return ['36a,36b', '36a'];
  }
  */
  /**
   * 畑を耕すそして/または種をまく
   */
  // TODO 実装だけどデフォでよくない？
  // とりあえずデフォのものを用いる
  /*
  createPloughingSowPrior() {
    return ['42b,42a', '42a,42b', '42a', '42b'];
  }
  */
  // 詳細選択
  /**
   * 家の配置
   */
  createHousePrior() {
    return ['1;1', '2;1', '1;2', '2;2'];
  }
  /**
   * 厩の配置
   */
  createStablePrior() {
    return ['1;3', '2;3', '1;4', '2;4'];
  }
  /**
   * 畑の配置
   */
  createPloughingPrior() {
    return ['0;0', '0;1', '0;2', '0;3', '0;4'];
  }
  /**
   * 小進歩
   */
  createMinorImporvementPrior() {
    return Object.keys(MINOR_IMPROVEMENTS).sort((a, b) => EVALUATION_IMPROVEMENTS[b] - EVALUATION_IMPROVEMENTS[a]);
  }
  /**
   * 大進歩
   */
  createMajorImprovementPrior() {
    return [IMPROVEMENTS.FIREPLACE2, IMPROVEMENTS.FIREPLACE3, IMPROVEMENTS.COOKING_HEARTH4, IMPROVEMENTS.COOKING_HEARTH5, ...this.createMinorImporvementPrior()];
  }
  /**
   * 職業
   */
  createOccupationPrior() {
    return Object.keys(EVALUATION_OCCUPATIONS).sort((a, b) => EVALUATION_OCCUPATIONS[b] - EVALUATION_OCCUPATIONS[a]);
  }
};

module.exports = AI;