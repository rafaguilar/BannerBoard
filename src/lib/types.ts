export type Banner = {
  id: string;
  url: string;
  width: number;
  height: number;
  round: number;
  version: number;
};

export type Preset = {
  id: string;
  name: string;
  banners: Banner[];
};
