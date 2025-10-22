
export type Banner = {
  id: string;
  url: string;
  width: number;
  height: number;
  round: number;
  version: number;
  groupId?: string;
  key?: string;
};

export type Preset = {
  id: string;
  name: string;
  banners: Banner[];
};
