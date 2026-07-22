export interface ClashArmyUnit {
  home: 'armyCamp' | 'clanCastle';
  unitId: number;
  amount: number;
}

export interface ClashArmyEquipment {
  equipmentId: number;
}

export interface ClashArmyPet {
  hero: string;
  petId: number;
}

export interface ClashArmyGuide {
  textContent: string;
  youtubeUrl: string | null;
}

export interface ClashArmy {
  id: number;
  name: string;
  townHall: number;
  banner: string;
  createdBy: string;
  username: string;
  score: number;
  votes: number;
  pageViews: number;
  tags: string[];
  units: ClashArmyUnit[];
  equipment: ClashArmyEquipment[];
  pets: ClashArmyPet[];
  guide: ClashArmyGuide | null;
  shareLink?: string;
  createdTime: string;
  updatedTime: string;
}

export interface UnitDef {
  id: number;
  type: 'Troop' | 'Spell' | 'Siege';
  name: string;
  housingSpace: number;
  productionBuilding: string;
  isSuper: boolean;
  isFlying: boolean;
}

export interface EquipmentDef {
  id: number;
  hero: string;
  name: string;
  epic: boolean;
}

export interface PetDef {
  id: number;
  name: string;
}
