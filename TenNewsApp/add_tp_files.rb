#!/usr/bin/env ruby
require 'xcodeproj'

project_path = File.expand_path('TenNewsApp.xcodeproj', __dir__)
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'TenNewsApp' }
abort 'target not found' unless target

app_group = project.main_group.find_subpath('TenNewsApp', false)
abort 'TenNewsApp group not found' unless app_group

swift_files = {
  'Models' => ['Models/DisplayModels.swift', 'Models/FeedModules.swift'],
  'DesignSystem' => ['DesignSystem/TPTokens.swift'],
  'Utilities' => ['Utilities/TemplateSelector.swift'],
}

swift_files.each do |group_name, paths|
  group = app_group.find_subpath(group_name, true)
  paths.each do |rel|
    file_name = File.basename(rel)
    next if group.files.any? { |f| f.path == file_name }
    ref = group.new_reference(File.expand_path("TenNewsApp/#{rel}", __dir__))
    target.add_file_references([ref])
    puts "added source #{rel}"
  end
end

views_group = app_group.find_subpath('Views', true)
tp_group = views_group.find_subpath('TodayPlusFeed', true)
%w[TPShared.swift TPCards.swift TPMapCard.swift TPModules.swift TPFeedView.swift].each do |name|
  next if tp_group.files.any? { |f| f.path == name }
  ref = tp_group.new_reference(File.expand_path("TenNewsApp/Views/TodayPlusFeed/#{name}", __dir__))
  target.add_file_references([ref])
  puts "added source Views/TodayPlusFeed/#{name}"
end

fonts_group = app_group.find_subpath('Fonts', true)
%w[InterTight-Bold.ttf InterTight-ExtraBold.ttf InterTight-BoldItalic.ttf].each do |name|
  next if fonts_group.files.any? { |f| f.path == name }
  ref = fonts_group.new_reference(File.expand_path("TenNewsApp/Fonts/#{name}", __dir__))
  target.add_resources([ref])
  puts "added resource Fonts/#{name}"
end

project.save
puts 'saved'
