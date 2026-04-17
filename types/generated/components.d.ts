import type { Schema, Struct } from '@strapi/strapi';

export interface SharedHeaderSlide extends Struct.ComponentSchema {
  collectionName: 'components_shared_header_slides';
  info: {
    description: 'Mensaje individual del slider superior';
    displayName: 'Header Slide';
  };
  attributes: {
    audience: Schema.Attribute.Enumeration<
      ['all', 'guest', 'account', 'member']
    > &
      Schema.Attribute.DefaultTo<'all'>;
    endsAt: Schema.Attribute.DateTime;
    isActive: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<true>;
    message: Schema.Attribute.Text & Schema.Attribute.Required;
    startsAt: Schema.Attribute.DateTime;
    title: Schema.Attribute.String;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'shared.header-slide': SharedHeaderSlide;
    }
  }
}
